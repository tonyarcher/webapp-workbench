package rssapi.web

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import rssapi.domain.OpmlFolder
import rssapi.domain.OpmlNode
import rssapi.domain.OpmlSource
import rssapi.domain.hostTitleFor
import rssapi.domain.parseOpml
import rssapi.domain.safeHttpUrl
import rssapi.ingest.IngestSync
import rssapi.persist.FeedEntity
import rssapi.persist.FeedRepo
import rssapi.persist.FolderEntity
import rssapi.persist.FolderFeedEntity
import rssapi.persist.FolderFeedRepo
import rssapi.persist.FolderRepo
import rssapi.persist.SubscriptionEntity
import rssapi.persist.SubscriptionRepo
import java.util.UUID

private data class FlatEntry(val folderTitles: List<String>, val source: OpmlSource)

private data class CleanEntry(val url: String, val title: String, val siteUrl: String?, val folderTitles: Set<String>)

/**
 * Bulk OPML subscription import. Creates folders, pool feeds, subscriptions,
 * and memberships with a handful of batched queries and returns the names so
 * the UI paints the library before any article content arrives.
 */
@Service
class OpmlImportService(
    private val folders: FolderRepo,
    private val feeds: FeedRepo,
    private val memberships: FolderFeedRepo,
    private val sync: IngestSync,
    private val subs: SubscriptionRepo,
) {
    @Transactional
    fun run(userId: UUID, xml: String): OpmlImportResult {
        val flat = flatten(parseOpml(xml))
        val cleanedResult = clean(flat)
        val cleaned = cleanedResult.map
        val folderResult = ensureFolders(userId, cleaned.values.flatMap { it.folderTitles }.distinct())
        val feedResult = ensureFeeds(cleaned)
        val subscribed = ensureSubs(userId, feedResult.map.values.toList())
        ensureMemberships(cleaned, folderResult.map, feedResult.map)
        sync.ensureRows(feedResult.map.values.mapNotNull { it.id })
        return toResult(folderResult, feedResult, cleaned, subscribed, cleanedResult.invalid)
    }

    private fun flatten(nodes: List<OpmlNode>): List<FlatEntry> {
        val out = mutableListOf<FlatEntry>()
        collect(nodes, emptyList(), out)
        return out
    }

    private fun collect(nodes: List<OpmlNode>, stack: List<String>, out: MutableList<FlatEntry>) {
        for (node in nodes) {
            if (node is OpmlFolder) {
                collect(node.children, stack + node.title.trim(), out)
            } else if (node is OpmlSource) {
                out.add(FlatEntry(stack, node))
            }
        }
    }

    private data class CleanResult(val map: LinkedHashMap<String, CleanEntry>, val invalid: Int)

    private fun clean(flat: List<FlatEntry>): CleanResult {
        val out = LinkedHashMap<String, CleanEntry>()
        var invalid = 0
        for (entry in flat) {
            val url = safeHttpUrl(entry.source.xmlUrl.trim())
            if (url == null) {
                invalid += 1
                continue
            }
            val title = entry.source.title.trim().ifEmpty { hostTitleFor(url) }
            val folderTitles = entry.folderTitles.map { it.trim() }.filter { it.isNotEmpty() }.toSet()
            val prev = out[url]
            if (prev == null) {
                out[url] = CleanEntry(url, title, entry.source.htmlUrl, folderTitles)
            } else {
                out[url] = prev.copy(folderTitles = prev.folderTitles + folderTitles)
            }
        }
        return CleanResult(out, invalid)
    }

    private data class FoldersResult(val map: Map<String, FolderEntity>, val added: Int)

    private data class FeedsResult(val map: Map<String, FeedEntity>, val added: Int)

    private fun ensureFolders(userId: UUID, titles: List<String>): FoldersResult {
        if (titles.isEmpty()) return FoldersResult(emptyMap(), 0)
        val existing = folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(userId).associateBy { it.title }
        val maxSort = existing.values.maxOfOrNull { it.sortOrder } ?: -1
        val missing = titles.filter { it !in existing }.distinct().mapIndexed { i, t ->
            FolderEntity(userId = userId, title = t, sortOrder = maxSort + 1 + i)
        }
        val saved = if (missing.isEmpty()) emptyList() else folders.saveAll(missing)
        val map = (existing.values + saved).associateBy { it.title }.filterKeys { it in titles.toSet() }
        return FoldersResult(map, saved.size)
    }

    private fun ensureFeeds(cleaned: Map<String, CleanEntry>): FeedsResult {
        if (cleaned.isEmpty()) return FeedsResult(emptyMap(), 0)
        val existing = feeds.findByXmlUrlIn(cleaned.keys).associateBy { it.xmlUrl }
        val missing = cleaned.values.filter { it.url !in existing }.map {
            FeedEntity(xmlUrl = it.url, title = it.title, siteUrl = it.siteUrl)
        }
        val saved = if (missing.isEmpty()) emptyList() else feeds.saveAll(missing)
        return FeedsResult((existing.values + saved).associateBy { it.xmlUrl }, saved.size)
    }

    private fun ensureSubs(userId: UUID, feedRows: List<FeedEntity>): Int {
        val ids = feedRows.mapNotNull { it.id }
        if (ids.isEmpty()) return 0
        val have = subs.findFeedIdsByUserId(userId).toSet()
        val missing = ids.filter { it !in have }.map { SubscriptionEntity(userId = userId, feedId = it) }
        if (missing.isNotEmpty()) subs.saveAll(missing)
        return missing.size
    }

    private fun ensureMemberships(
        cleaned: Map<String, CleanEntry>,
        folderMap: Map<String, FolderEntity>,
        feedMap: Map<String, FeedEntity>,
    ) {
        val folderIds = folderMap.values.mapNotNull { it.id }
        val have = if (folderIds.isEmpty()) {
            emptySet()
        } else {
            memberships.findByFolderIdIn(folderIds).map { it.folderId to it.feedId }.toSet()
        }
        val missing = mutableListOf<FolderFeedEntity>()
        for ((url, entry) in cleaned) {
            val feedId = feedMap[url]?.id ?: continue
            for (title in entry.folderTitles) {
                val folderId = folderMap[title]?.id ?: continue
                if (folderId to feedId !in have) missing.add(FolderFeedEntity(folderId = folderId, feedId = feedId))
            }
        }
        if (missing.isNotEmpty()) memberships.saveAll(missing)
    }

    private fun toResult(
        folderResult: FoldersResult,
        feedResult: FeedsResult,
        cleaned: Map<String, CleanEntry>,
        subscribed: Int,
        skipped: Int,
    ): OpmlImportResult {
        val folderRows = folderResult.map.values.sortedBy { it.sortOrder }
        val feedByFolder = mutableMapOf<UUID, MutableList<String>>()
        for ((url, entry) in cleaned) {
            val feedId = feedResult.map[url]?.id ?: continue
            for (title in entry.folderTitles) {
                val folderId = folderResult.map[title]?.id ?: continue
                feedByFolder.getOrPut(feedId) { mutableListOf() }.add(folderId.toString())
            }
        }
        val feedRows = feedResult.map.values.sortedBy { it.addedAt }.map { feed ->
            feed.toJson(feedByFolder[feed.id] ?: emptyList(), 0, null, null)
        }
        return OpmlImportResult(
            addedFeeds = feedResult.added,
            addedFolders = folderResult.added,
            subscribedFeeds = subscribed,
            skippedFeeds = skipped,
            folders = folderRows.map { it.toJson() },
            feeds = feedRows,
        )
    }
}
