package rssapi.web

import org.springframework.stereotype.Service
import rssapi.domain.ArticleScope
import rssapi.domain.ArticleSort
import rssapi.domain.parseSearchQueryText
import rssapi.persist.ArticleRepo
import rssapi.persist.FeedRepo
import rssapi.persist.FeedSyncEntity
import rssapi.persist.FeedSyncRepo
import rssapi.persist.FolderEntity
import rssapi.persist.FolderFeedRepo
import rssapi.persist.FolderRepo
import rssapi.persist.SavedSearchEntity
import rssapi.persist.SavedSearchRepo
import rssapi.persist.SubscriptionRepo
import java.util.UUID

/** Bulk library reads. Each call runs a fixed handful of queries, sized by table, not by feed. */
@Service
class LibraryService(
    private val folders: FolderRepo,
    private val feeds: FeedRepo,
    private val sync: FeedSyncRepo,
    private val articles: ArticleRepo,
    private val subs: SubscriptionRepo,
    private val memberships: FolderFeedRepo,
    private val savedSearches: SavedSearchRepo,
) {
    fun folders(uid: UUID): List<FolderJson> =
        folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid).map { it.toJson() }

    fun savedSearches(uid: UUID): List<SavedSearchJson> =
        savedSearches.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid).map { it.toJson() }

    fun feeds(uid: UUID): List<FeedJson> {
        val folderRows = folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid)
        val feedIds = subs.findFeedIdsByUserId(uid)
        if (feedIds.isEmpty()) return emptyList()
        return feedJsons(folderRows, feedIds, emptyMap())
    }

    fun counts(uid: UUID): LibraryCountsJson {
        val feedIds = subs.findFeedIdsByUserId(uid)
        val counts = unreadMap(uid, feedIds).mapKeys { it.key.toString() }.filterValues { it > 0 }
        val savedCounts = savedSearchUnreadMap(uid).filterValues { it > 0 }
        return LibraryCountsJson(counts, savedCounts)
    }

    fun library(uid: UUID): LibraryJson {
        val folderRows = folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid)
        val searchRows = savedSearches.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid)
        val feedIds = subs.findFeedIdsByUserId(uid)
        val savedCounts = savedSearchUnreadMap(uid)
        val searches = searchRows.map { it.toJson(savedCounts[it.id.toString()] ?: 0) }
        if (feedIds.isEmpty()) return LibraryJson(folderRows.map { it.toJson() }, emptyList(), searches)
        return LibraryJson(
            folderRows.map { it.toJson() },
            feedJsons(folderRows, feedIds, unreadMap(uid, feedIds)),
            searches,
        )
    }

    private fun feedJsons(
        folderRows: List<FolderEntity>,
        feedIds: List<UUID>,
        unread: Map<UUID, Int>,
    ): List<FeedJson> {
        val owned = folderRows.mapNotNull { it.id }.toSet()
        val folderMap = if (owned.isEmpty()) {
            emptyMap()
        } else {
            memberships.findByFeedIdIn(feedIds)
                .filter { it.folderId in owned }
                .groupBy({ it.feedId }, { it.folderId.toString() })
        }
        val syncs = syncMap(feedIds)
        return feeds.findAllById(feedIds).sortedBy { it.addedAt }.map { feed ->
            val st = syncs[feed.id]
            feed.toJson(
                folderMap[feed.id] ?: emptyList(),
                unread[feed.id] ?: 0,
                st?.lastFetchedAt?.toEpochMilli(),
                st?.lastError,
            )
        }
    }

    private fun syncMap(feedIds: List<UUID>): Map<UUID, FeedSyncEntity> =
        sync.findAllById(feedIds).associateBy { it.feedId }

    private fun unreadMap(uid: UUID, feedIds: List<UUID>): Map<UUID, Int> {
        if (feedIds.isEmpty()) return emptyMap()
        return articles.countUnreadByFeed(uid, feedIds).associate { it.feedId to it.cnt.toInt() }
    }

    private fun savedSearchUnreadMap(uid: UUID): Map<String, Int> {
        val rows = savedSearches.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid)
        if (rows.isEmpty()) return emptyMap()
        return rows.associate { row ->
            row.id.toString() to savedSearchUnreadCount(uid, row)
        }
    }

    private fun savedSearchUnreadCount(uid: UUID, row: SavedSearchEntity): Int {
        val scope = scopeOf(row)
        val parsed = parseSearchQueryText(row.query)
        // A saved search with no text and no enforceable ops matches nothing useful server-side
        // (non-enforceable-only handled like client); count as 0 to avoid full scans.
        if (parsed.tokens.isEmpty() && !parsed.hasEnforceableOperator()) return 0
        val spec = articleSpec(uid, scope, true, ArticleSort.NEWEST, null, null, parsed)
        return articles.count(spec).toInt().coerceAtLeast(0)
    }

    private fun scopeOf(row: SavedSearchEntity): ArticleScope = when (row.scopeKind) {
        "feed" -> row.scopeId?.let { ArticleScope.Feed(it) } ?: ArticleScope.All
        "folder" -> row.scopeId?.let { ArticleScope.Folder(it) } ?: ArticleScope.All
        else -> ArticleScope.All
    }
}
