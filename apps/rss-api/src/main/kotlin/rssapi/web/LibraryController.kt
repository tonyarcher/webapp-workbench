package rssapi.web

import java.util.UUID
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import rssapi.domain.isUuid
import rssapi.persist.ArticleRepo
import rssapi.persist.FeedRepo
import rssapi.persist.FeedSyncEntity
import rssapi.persist.FeedSyncRepo
import rssapi.persist.FolderEntity
import rssapi.persist.FolderFeedRepo
import rssapi.persist.FolderRepo
import rssapi.persist.SubscriptionRepo

@RestController
class LibraryController(
    private val user: IdentityUser,
    private val folders: FolderRepo,
    private val feeds: FeedRepo,
    private val sync: FeedSyncRepo,
    private val articles: ArticleRepo,
    private val subs: SubscriptionRepo,
    private val memberships: FolderFeedRepo,
) {
    /** Names and structure in a fixed handful of queries; never touches the articles table. */
    @GetMapping("/library")
    fun library(): LibraryJson {
        val uid = user.id
        val folderRows = folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid)
        val feedIds = subs.findFeedIdsByUserId(uid)
        if (feedIds.isEmpty()) return LibraryJson(folderRows.map { it.toJson() }, emptyList())
        return buildLibrary(folderRows, feedIds)
    }

    /** Unread badges, decoupled so the feed list paints without waiting on the articles table. */
    @GetMapping("/library/counts")
    fun counts(): LibraryCountsJson {
        val uid = user.id
        val feedIds = subs.findFeedIdsByUserId(uid)
        val counts = unreadMap(uid, feedIds).mapKeys { it.key.toString() }.filterValues { it > 0 }
        return LibraryCountsJson(counts)
    }

    private fun buildLibrary(
        folderRows: List<FolderEntity>,
        feedIds: List<UUID>,
    ): LibraryJson {
        val owned = folderRows.mapNotNull { it.id }.toSet()
        val folderMap = if (owned.isEmpty()) {
            emptyMap()
        } else {
            memberships.findByFeedIdIn(feedIds)
                .filter { it.folderId in owned }
                .groupBy({ it.feedId }, { it.folderId.toString() })
        }
        val syncs = syncMap(feedIds)
        val feedRows = feeds.findAllById(feedIds).sortedBy { it.addedAt }
        return LibraryJson(
            folders = folderRows.map { it.toJson() },
            feeds = feedRows.map { feed ->
                val st = syncs[feed.id]
                feed.toJson(
                    folderMap[feed.id] ?: emptyList(),
                    0,
                    st?.lastFetchedAt?.toEpochMilli(),
                    st?.lastError,
                )
            },
        )
    }

    private fun syncMap(feedIds: List<UUID>): Map<UUID, FeedSyncEntity> =
        sync.findAllById(feedIds).associateBy { it.feedId }

    private fun unreadMap(uid: UUID, feedIds: List<UUID>): Map<UUID, Int> {
        if (feedIds.isEmpty()) return emptyMap()
        return articles.countUnreadByFeed(uid, feedIds).associate { it.feedId to it.cnt.toInt() }
    }
    @PostMapping("/folders")
    fun createFolder(@RequestBody body: TitleBody): FolderJson {
        val title = body.title?.trim() ?: throw ApiException(400, "title is required")
        if (title.isEmpty()) throw ApiException(400, "title is required")
        val existing = folders.findByUserIdAndTitle(user.id, title)
        val row = existing ?: folders.save(FolderEntity(userId = user.id, title = title))
        return row.toJson()
    }

    @DeleteMapping("/folders/{id}")
    fun deleteFolder(@PathVariable id: String): OkBody {
        if (!isUuid(id)) throw ApiException(400, "invalid folder id")
        folders.findById(UUID.fromString(id)).filter { it.userId == user.id }.ifPresent { folders.delete(it) }
        return OkBody()
    }

    @PostMapping("/folders/reorder")
    fun reorder(@RequestBody body: IdsBody): OkBody {
        val ids = body.ids ?: throw ApiException(400, "ids array is required")
        ids.forEachIndexed { index, raw ->
            if (!isUuid(raw)) return@forEachIndexed
            val folder = folders.findById(UUID.fromString(raw)).orElse(null) ?: return@forEachIndexed
            if (folder.userId != user.id) return@forEachIndexed
            folder.sortOrder = index
            folders.save(folder)
        }
        return OkBody()
    }
}
