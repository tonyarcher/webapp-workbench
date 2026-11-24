package timesupapi.feeds
import org.springframework.stereotype.Service
import timesupapi.articles.ArticleRepo
import timesupapi.boards.SavedSearchRepo
import timesupapi.boards.SavedSearchService
import timesupapi.platform.toJson
import java.time.Duration
import java.time.Instant
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
    private val searchCounts: SavedSearchService,
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

    fun recentCounts(uid: UUID, days: Int): FeedRecentListJson {
        val feedIds = subs.findFeedIdsByUserId(uid)
        if (feedIds.isEmpty()) return FeedRecentListJson(days, emptyList())
        val since = Instant.now().minus(Duration.ofDays(days.toLong()))
        return FeedRecentListJson(
            days,
            articles.countRecentByFeed(feedIds, since).associateBy { it.feedId }.let { counts ->
                feedIds.map { FeedRecentJson(it.toString(), (counts[it]?.cnt ?: 0).toInt().coerceAtLeast(0)) }
            },
        )
    }

    fun counts(uid: UUID): LibraryCountsJson {
        val feedIds = subs.findFeedIdsByUserId(uid)
        val counts = unreadMap(uid, feedIds).mapKeys { it.key.toString() }.filterValues { it > 0 }
        val savedCounts = searchCounts.unreadMap(uid).filterValues { it > 0 }
        return LibraryCountsJson(counts, savedCounts)
    }

    fun library(uid: UUID): LibraryJson {
        val folderRows = folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid)
        val searchRows = savedSearches.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid)
        val feedIds = subs.findFeedIdsByUserId(uid)
        val savedCounts = searchCounts.unreadMap(uid)
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
            feedJson(feed, syncs[feed.id], folderMap, unread)
        }
    }

    private fun feedJson(
        feed: FeedEntity,
        st: FeedSyncEntity?,
        folderMap: Map<UUID, List<String>>,
        unread: Map<UUID, Int>,
    ): FeedJson {
        val fetched = st?.lastFetchedAt?.toEpochMilli()
        val failures = st?.consecutiveFailures ?: 0
        val health = FeedHealth.statusOf(st?.lastError, failures, fetched, System.currentTimeMillis())
        return feed.toJson(
            folderMap[feed.id] ?: emptyList(),
            unread[feed.id] ?: 0,
            fetched,
            st?.lastError,
            failures,
            health,
            feed.sourceKind,
            feed.itemSelector,
        )
    }

    private fun syncMap(feedIds: List<UUID>): Map<UUID, FeedSyncEntity> =
        sync.findAllById(feedIds).associateBy { it.feedId }

    private fun unreadMap(uid: UUID, feedIds: List<UUID>): Map<UUID, Int> {
        if (feedIds.isEmpty()) return emptyMap()
        return articles.countUnreadByFeed(uid, feedIds).associate { it.feedId to it.cnt.toInt() }
    }
}
