package rssapi.web

import java.util.UUID
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import rssapi.domain.isUuid
import rssapi.persist.FolderEntity
import rssapi.persist.FolderRepo

@RestController
class LibraryController(
    private val user: IdentityUser,
    private val folders: FolderRepo,
    private val library: LibraryService,
) {
    @GetMapping("/library")
    fun library(): LibraryJson = library.library(user.id)

    @GetMapping("/library/counts")
    fun counts(): LibraryCountsJson = LibraryCountsJson(library.counts(user.id))

    /** Folder list alone so the sidebar paints before feed names arrive. */
    @GetMapping("/library/folders")
    fun folders(): LibraryFoldersJson = LibraryFoldersJson(library.folders(user.id))

    /** Feed names and structure without article counts. */
    @GetMapping("/library/feeds")
    fun feeds(): LibraryFeedsJson = LibraryFeedsJson(library.feeds(user.id))

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
    @Transactional
    fun reorder(@RequestBody body: IdsBody): OkBody {
        val ids = body.ids ?: throw ApiException(400, "ids array is required")
        val uuids = ids.filter { isUuid(it) }.map { UUID.fromString(it) }
        if (uuids.isEmpty()) return OkBody()
        val rows = folders.findAllById(uuids).filter { it.userId == user.id }
        val order = uuids.withIndex().associate { it.value to it.index }
        rows.forEach { it.sortOrder = order[it.id] ?: it.sortOrder }
        folders.saveAll(rows)
        return OkBody()
    }
}
