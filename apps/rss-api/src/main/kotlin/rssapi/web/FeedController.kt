package rssapi.web

import java.net.URI
import java.util.UUID
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import rssapi.domain.isUuid
import rssapi.domain.safeHttpUrl
import rssapi.ingest.IngestService
import rssapi.ingest.IngestSync
import rssapi.persist.ArticleRepo
import rssapi.persist.FeedEntity
import rssapi.persist.FeedRepo
import rssapi.persist.FeedSyncRepo
import rssapi.persist.FolderFeedEntity
import rssapi.persist.FolderFeedRepo
import rssapi.persist.FolderRepo

@RestController
class FeedController(
    private val user: CookieUser,
    private val feeds: FeedRepo,
    private val folders: FolderRepo,
    private val memberships: FolderFeedRepo,
    private val ingest: IngestService,
    private val sync: IngestSync,
    private val articleRepo: ArticleRepo,
    private val syncRows: FeedSyncRepo,
) {
    @PostMapping("/feeds")
    fun create(@RequestBody body: CreateFeedBody): FeedJson {
        val url = body.url ?: throw ApiException(400, "url is required")
        val validated = safeHttpUrl(url) ?: throw ApiException(400, "Invalid feed URL (must be http/https)")
        val folderIds = parseFolderIds(body.folderIds ?: emptyList())
        requireOwnedFolders(folderIds)
        val title = URI(validated).toURL().host
        val feed = upsertFeed(validated, title)
        folderIds.forEach { memberships.save(FolderFeedEntity(folderId = it, feedId = feed.id!!)) }
        sync.ensureRow(feed.id!!)
        ingest.fetchAndIngest(user.id, feed.id!!)
        return loadedFeed(feed.id!!)
    }

    @DeleteMapping("/feeds/{id}")
    fun delete(@PathVariable id: String): OkBody {
        if (!isUuid(id)) throw ApiException(400, "invalid feed id")
        val feed = feeds.findByUserIdAndId(user.id, UUID.fromString(id))
            ?: throw ApiException(404, "Feed not found")
        feeds.delete(feed)
        return OkBody()
    }

    @PutMapping("/feeds/{id}/folders")
    fun setFolders(@PathVariable id: String, @RequestBody body: FolderIdsBody): OkBody {
        if (!isUuid(id)) throw ApiException(400, "invalid feed id")
        val folderIds = body.folderIds ?: throw ApiException(400, "folderIds array is required")
        val feedId = UUID.fromString(id)
        requireFeed(feedId)
        val uuids = parseFolderIds(folderIds)
        requireOwnedFolders(uuids)
        replaceFolders(feedId, uuids)
        return OkBody()
    }

    private fun loadedFeed(feedId: UUID): FeedJson {
        val fresh = feeds.findByUserIdAndId(user.id, feedId) ?: error("missing feed")
        val fids = memberships.findByFeedId(feedId).map { it.folderId.toString() }
        val st = syncRows.findById(feedId).orElse(null)
        return fresh.toJson(
            fids,
            articleRepo.countUnread(feedId, user.id).toInt(),
            st?.lastFetchedAt?.toEpochMilli(),
            st?.lastError,
        )
    }

    private fun requireFeed(feedId: UUID) {
        if (feeds.findByUserIdAndId(user.id, feedId) == null) throw ApiException(404, "Feed not found")
    }

    private fun upsertFeed(url: String, title: String): FeedEntity {
        val existing = feeds.findByUserIdAndXmlUrl(user.id, url)
        if (existing != null) return existing
        return feeds.save(FeedEntity(userId = user.id, xmlUrl = url, title = title))
    }

    private fun requireOwnedFolders(ids: List<UUID>) {
        if (ids.isEmpty()) return
        val owned = folders.findByUserIdAndIdIn(user.id, ids)
        if (owned.size != ids.size) throw ApiException(400, "Unknown folder in folderIds")
    }

    private fun replaceFolders(feedId: UUID, folderIds: List<UUID>) {
        memberships.deleteByFeedId(feedId)
        folderIds.forEach { memberships.save(FolderFeedEntity(folderId = it, feedId = feedId)) }
    }

    private fun parseFolderIds(raw: List<String>): List<UUID> {
        if (raw.any { !isUuid(it) }) throw ApiException(400, "Unknown folder in folderIds")
        return raw.map { UUID.fromString(it) }
    }
}
