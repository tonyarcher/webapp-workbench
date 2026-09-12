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
import rssapi.persist.FeedSyncRepo
import rssapi.persist.FolderEntity
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
    private val membershipService: MembershipService,
) {
    @GetMapping("/library")
    fun library(): LibraryJson {
        val uid = user.id
        val folderRows = folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid)
        val feedRows = feeds.findAllById(subs.findFeedIdsByUserId(uid)).sortedBy { it.addedAt }
        return LibraryJson(
            folders = folderRows.map { it.toJson() },
            feeds = feedRows.map { feed ->
                val fids = membershipService.ownedFolderIds(uid, feed.id!!)
                val st = sync.findById(feed.id!!).orElse(null)
                feed.toJson(
                    fids,
                    articles.countUnread(feed.id!!, uid).toInt(),
                    st?.lastFetchedAt?.toEpochMilli(),
                    st?.lastError,
                )
            },
        )
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
