package rssapi.web

import org.springframework.http.HttpStatus
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import rssapi.domain.isUuid
import rssapi.persist.SavedSearchEntity
import rssapi.persist.SavedSearchRepo
import java.util.UUID

@RestController
class SavedSearchController(private val user: IdentityUser, private val savedSearches: SavedSearchRepo) {
    @PostMapping("/saved-searches", headers = ["X-Api-Version=1"])
    fun create(@RequestBody body: SavedSearchBody): SavedSearchJson {
        val title = body.title?.trim()?.takeIf { it.isNotEmpty() }
            ?: throw ApiException(HttpStatus.BAD_REQUEST, "title is required")
        val scopeKind = normalizeScopeKind(body.scopeKind) ?: "all"
        val row = savedSearches.save(
            SavedSearchEntity(
                userId = user.id,
                title = title,
                query = body.query?.trim() ?: "",
                scopeKind = scopeKind,
                scopeId = if (scopeKind == "all") null else parseOptionalUuid(body.scopeId),
            ),
        )
        return row.toJson()
    }

    @PutMapping("/saved-searches/{id}", headers = ["X-Api-Version=1"])
    fun update(@PathVariable id: String, @RequestBody body: SavedSearchBody): SavedSearchJson {
        val row = find(id)
        body.title?.trim()?.takeIf { it.isNotEmpty() }?.let { row.title = it }
        body.query?.let { row.query = it.trim() }
        applyScope(row, body)
        return savedSearches.save(row).toJson()
    }

    @DeleteMapping("/saved-searches/{id}", headers = ["X-Api-Version=1"])
    fun remove(@PathVariable id: String): OkBody {
        savedSearches.findByUserIdAndId(user.id, parseId(id))?.let { savedSearches.delete(it) }
        return OkBody()
    }

    @PostMapping("/saved-searches/reorder", headers = ["X-Api-Version=1"])
    @Transactional
    fun reorder(@RequestBody body: IdsBody): OkBody {
        val ids = body.ids ?: throw ApiException(HttpStatus.BAD_REQUEST, "ids array is required")
        val uuids = ids.filter { isUuid(it) }.map { UUID.fromString(it) }
        if (uuids.isEmpty()) return OkBody()
        val rows = savedSearches.findByUserIdAndIdIn(user.id, uuids)
        val order = uuids.withIndex().associate { it.value to it.index }
        rows.forEach { it.sortOrder = order[it.id] ?: it.sortOrder }
        savedSearches.saveAll(rows)
        return OkBody()
    }

    private fun find(id: String): SavedSearchEntity = savedSearches.findByUserIdAndId(user.id, parseId(id))
        ?: throw ApiException(HttpStatus.NOT_FOUND, "Saved search not found")

    private fun parseId(raw: String): UUID {
        if (!isUuid(raw)) throw ApiException(HttpStatus.BAD_REQUEST, "invalid saved search id")
        return UUID.fromString(raw)
    }

    private fun applyScope(row: SavedSearchEntity, body: SavedSearchBody) {
        val kind = normalizeScopeKind(body.scopeKind)
        if (kind != null) {
            row.scopeKind = kind
            row.scopeId = if (kind == "all") null else parseOptionalUuid(body.scopeId)
        } else if (body.scopeId != null) {
            row.scopeId = parseOptionalUuid(body.scopeId)
        }
    }
}

private fun normalizeScopeKind(raw: String?): String? = when (raw) {
    null -> null
    "folder", "feed", "all" -> raw
    else -> "all"
}

private fun parseOptionalUuid(raw: String?): UUID? {
    if (raw.isNullOrBlank()) return null
    if (!isUuid(raw)) throw ApiException(HttpStatus.BAD_REQUEST, "invalid scope id")
    return UUID.fromString(raw)
}
