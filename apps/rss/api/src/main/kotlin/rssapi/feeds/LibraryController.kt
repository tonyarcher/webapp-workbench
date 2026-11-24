package rssapi.feeds
import org.springframework.http.HttpStatus
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import rssapi.platform.ApiException
import rssapi.platform.IdentityUser
import rssapi.platform.isUuid
import rssapi.platform.toJson
import java.util.UUID

/** Recent article counts per subscribed feed, for the health dashboard. */
data class FeedRecentJson(val feedId: String, val count: Int)
data class FeedRecentListJson(val days: Int, val feeds: List<FeedRecentJson>)

private const val MAX_RECENT_DAYS = 365

@RestController
class LibraryController(
    private val user: IdentityUser,
    private val folders: FolderRepo,
    private val library: LibraryService,
) {
    @GetMapping("/library/recent", headers = ["X-Api-Version=1"])
    fun recent(@RequestParam(defaultValue = "30") days: Int): FeedRecentListJson =
        library.recentCounts(user.id, days.coerceIn(1, MAX_RECENT_DAYS))

    @GetMapping("/library", headers = ["X-Api-Version=1"])
    fun library(): LibraryJson = library.library(user.id)

    @GetMapping("/library/counts", headers = ["X-Api-Version=1"])
    fun counts(): LibraryCountsJson = library.counts(user.id)

    /** Folder list (and saved searches) alone so the sidebar paints before feed names arrive. */
    @GetMapping("/library/folders", headers = ["X-Api-Version=1"])
    fun folders(): LibraryFoldersJson = LibraryFoldersJson(library.folders(user.id), library.savedSearches(user.id))

    /** Feed names and structure without article counts. */
    @GetMapping("/library/feeds", headers = ["X-Api-Version=1"])
    fun feeds(): LibraryFeedsJson = LibraryFeedsJson(library.feeds(user.id))

    @PostMapping("/folders", headers = ["X-Api-Version=1"])
    fun createFolder(@RequestBody body: TitleBody): FolderJson {
        val title = body.title?.trim() ?: throw ApiException(HttpStatus.BAD_REQUEST, "title is required")
        if (title.isEmpty()) throw ApiException(HttpStatus.BAD_REQUEST, "title is required")
        val existing = folders.findByUserIdAndTitle(user.id, title)
        val row = existing ?: folders.save(FolderEntity(userId = user.id, title = title))
        return row.toJson()
    }

    @PutMapping("/folders/{id}", headers = ["X-Api-Version=1"])
    fun renameFolder(@PathVariable id: String, @RequestBody body: TitleBody): FolderJson {
        if (!isUuid(id)) throw ApiException(HttpStatus.BAD_REQUEST, "invalid folder id")
        val title = body.title?.trim()?.takeIf { it.isNotEmpty() }
            ?: throw ApiException(HttpStatus.BAD_REQUEST, "title is required")
        val row = folders.findById(UUID.fromString(id)).filter { it.userId == user.id }.orElseThrow {
            ApiException(HttpStatus.NOT_FOUND, "folder not found")
        }
        ensureUniqueTitle(row, title)
        row.title = title
        return folders.save(row).toJson()
    }

    private fun ensureUniqueTitle(row: FolderEntity, title: String) {
        val clash = folders.findByUserIdAndTitle(user.id, title)
        if (clash != null && clash.id != row.id) {
            throw ApiException(HttpStatus.CONFLICT, "folder title already exists")
        }
    }

    @DeleteMapping("/folders/{id}", headers = ["X-Api-Version=1"])
    fun deleteFolder(@PathVariable id: String): OkBody {
        if (!isUuid(id)) throw ApiException(HttpStatus.BAD_REQUEST, "invalid folder id")
        folders.findById(UUID.fromString(id)).filter { it.userId == user.id }.ifPresent { folders.delete(it) }
        return OkBody()
    }

    @PostMapping("/folders/reorder", headers = ["X-Api-Version=1"])
    @Transactional
    fun reorder(@RequestBody body: IdsBody): OkBody {
        val ids = body.ids ?: throw ApiException(HttpStatus.BAD_REQUEST, "ids array is required")
        val uuids = ids.filter { isUuid(it) }.map { UUID.fromString(it) }
        if (uuids.isEmpty()) return OkBody()
        val rows = folders.findAllById(uuids).filter { it.userId == user.id }
        val order = uuids.withIndex().associate { it.value to it.index }
        rows.forEach { it.sortOrder = order[it.id] ?: it.sortOrder }
        folders.saveAll(rows)
        return OkBody()
    }
}
