package rssapi.web

import org.springframework.http.HttpStatus
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
import rssapi.persist.SavedSearchEntity
import rssapi.persist.SavedSearchRepo
import java.util.UUID

@RestController
class LibraryController(
    private val user: IdentityUser,
    private val folders: FolderRepo,
    private val savedSearches: SavedSearchRepo,
    private val library: LibraryService,
) {
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

    @PostMapping("/saved-searches", headers = ["X-Api-Version=1"])
    fun createSavedSearch(@RequestBody body: SavedSearchBody): SavedSearchJson {
        val title = body.title?.trim()?.takeIf { it.isNotEmpty() }
            ?: throw ApiException(HttpStatus.BAD_REQUEST, "title is required")
        val scopeKind = (body.scopeKind ?: "all").let {
            if (it == "folder" || it == "feed" ||
                it == "all"
            ) {
                it
            } else {
                "all"
            }
        }
        val scopeId = parseOptionalUuid(body.scopeId)
        val row = savedSearches.save(
            SavedSearchEntity(
                userId = user.id,
                title = title,
                query = body.query?.trim() ?: "",
                scopeKind = scopeKind,
                scopeId = if (scopeKind == "all") null else scopeId,
            ),
        )
        return row.toJson()
    }

    @org.springframework.web.bind.annotation.PutMapping("/saved-searches/{id}", headers = ["X-Api-Version=1"])
    fun updateSavedSearch(@PathVariable id: String, @RequestBody body: SavedSearchBody): SavedSearchJson {
        if (!isUuid(id)) throw ApiException(HttpStatus.BAD_REQUEST, "invalid saved search id")
        val row = savedSearches.findByUserIdAndId(user.id, UUID.fromString(id))
            ?: throw ApiException(HttpStatus.NOT_FOUND, "Saved search not found")
        body.title?.trim()?.takeIf { it.isNotEmpty() }?.let { row.title = it }
        body.query?.let { row.query = it.trim() }
        if (body.scopeKind != null) {
            val sk = if (body.scopeKind == "folder" || body.scopeKind == "feed" ||
                body.scopeKind == "all"
            ) {
                body.scopeKind
            } else {
                "all"
            }
            row.scopeKind = sk
            row.scopeId = if (sk == "all") null else parseOptionalUuid(body.scopeId)
        } else if (body.scopeId != null) {
            row.scopeId = parseOptionalUuid(body.scopeId)
        }
        return savedSearches.save(row).toJson()
    }

    @DeleteMapping("/saved-searches/{id}", headers = ["X-Api-Version=1"])
    fun deleteSavedSearch(@PathVariable id: String): OkBody {
        if (!isUuid(id)) throw ApiException(HttpStatus.BAD_REQUEST, "invalid saved search id")
        savedSearches.findByUserIdAndId(user.id, UUID.fromString(id))?.let { savedSearches.delete(it) }
        return OkBody()
    }

    @PostMapping("/saved-searches/reorder", headers = ["X-Api-Version=1"])
    @Transactional
    fun reorderSavedSearches(@RequestBody body: IdsBody): OkBody {
        val ids = body.ids ?: throw ApiException(HttpStatus.BAD_REQUEST, "ids array is required")
        val uuids = ids.filter { isUuid(it) }.map { UUID.fromString(it) }
        if (uuids.isEmpty()) return OkBody()
        val rows = savedSearches.findByUserIdAndIdIn(user.id, uuids)
        val order = uuids.withIndex().associate { it.value to it.index }
        rows.forEach { it.sortOrder = order[it.id] ?: it.sortOrder }
        savedSearches.saveAll(rows)
        return OkBody()
    }

    private fun parseOptionalUuid(raw: String?): UUID? {
        if (raw.isNullOrBlank()) return null
        if (!isUuid(raw)) throw ApiException(HttpStatus.BAD_REQUEST, "invalid scope id")
        return UUID.fromString(raw)
    }
}
