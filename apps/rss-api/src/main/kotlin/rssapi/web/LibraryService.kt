package rssapi.web

import java.util.UUID
import org.springframework.stereotype.Service
import rssapi.persist.ArticleRepo
import rssapi.persist.FeedRepo
import rssapi.persist.FeedSyncEntity
import rssapi.persist.FeedSyncRepo
import rssapi.persist.FolderEntity
import rssapi.persist.FolderFeedRepo
import rssapi.persist.FolderRepo
import rssapi.persist.SubscriptionRepo

/** Bulk library reads. Each call runs a fixed handful of queries, sized by table, not by feed. */
@Service
class LibraryService(
    private val folders: FolderRepo,
    private val feeds: FeedRepo,
    private val sync: FeedSyncRepo,
    private val articles: ArticleRepo,
    private val subs: SubscriptionRepo,
    private val memberships: FolderFeedRepo,
) {
    fun folders(uid: UUID): List<FolderJson> =
        folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid).map { it.toJson() }

    fun feeds(uid: UUID): List<FeedJson> {
        val folderRows = folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid)
        val feedIds = subs.findFeedIdsByUserId(uid)
        if (feedIds.isEmpty()) return emptyList()
        return feedJsons(folderRows, feedIds, emptyMap())
    }

    fun counts(uid: UUID): Map<String, Int> {
        val feedIds = subs.findFeedIdsByUserId(uid)
        return unreadMap(uid, feedIds).mapKeys { it.key.toString() }.filterValues { it > 0 }
    }

    fun library(uid: UUID): LibraryJson {
        val folderRows = folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid)
        val feedIds = subs.findFeedIdsByUserId(uid)
        if (feedIds.isEmpty()) return LibraryJson(folderRows.map { it.toJson() }, emptyList())
        return LibraryJson(folderRows.map { it.toJson() }, feedJsons(folderRows, feedIds, unreadMap(uid, feedIds)))
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
}
