package calsync.web

import calsync.trakt.TraktService
import calsync.trakt.calendarMoviesPath
import calsync.trakt.calendarShowsPath
import calsync.trakt.historyPath
import calsync.trakt.isCalendarDays
import calsync.trakt.isHistoryPage
import calsync.trakt.isTraktDate
import calsync.trakt.isTraktKind
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * Proxied Trakt data reads. Paths are explicit per collection (never a generic
 * pass-through): query values are validated here, and the service injects the
 * vault token plus one transparent refresh. Trakt's JSON passes through
 * untouched.
 */
@RestController
class TraktDataController(private val user: IdentityUser, private val trakt: TraktService) {
    @GetMapping("/trakt/calendars/{kind}", headers = ["X-Api-Version=1"])
    fun calendars(
        @PathVariable kind: String,
        @RequestParam(required = false) startDate: String?,
        @RequestParam(required = false) days: String?,
    ): ResponseEntity<String> {
        val collection = checkedKind(kind)
        val start = checkedStartDate(startDate)
        val window = checkedDays(days)
        val path = if (collection == "shows") calendarShowsPath(start, window) else calendarMoviesPath(start, window)
        return json(trakt.proxiedGet(user.id, path))
    }

    @GetMapping("/trakt/history/{kind}", headers = ["X-Api-Version=1"])
    fun history(
        @PathVariable kind: String,
        @RequestParam(required = false) page: String?,
        @RequestParam(required = false) limit: String?,
    ): ResponseEntity<String> {
        val collection = checkedKind(kind)
        val (pageNum, pageSize) = checkedPage(page, limit)
        return json(trakt.proxiedGet(user.id, historyPath(collection, pageNum, pageSize)))
    }

    private fun checkedKind(kind: String): String =
        kind.takeIf(::isTraktKind) ?: throw ApiException(HttpStatus.BAD_REQUEST, "invalid collection")

    private fun checkedStartDate(startDate: String?): String =
        startDate?.takeIf(::isTraktDate) ?: throw ApiException(HttpStatus.BAD_REQUEST, "invalid start date")

    private fun checkedDays(days: String?): Int {
        val window = days?.toIntOrNull()
        if (window == null || !isCalendarDays(window)) throw ApiException(HttpStatus.BAD_REQUEST, "invalid days")
        return window
    }

    private fun checkedPage(page: String?, limit: String?): Pair<Int, Int> {
        val pageNum = page?.toIntOrNull()
        val pageSize = limit?.toIntOrNull()
        if (pageNum == null || pageSize == null || !isHistoryPage(pageNum, pageSize)) {
            throw ApiException(HttpStatus.BAD_REQUEST, "invalid page")
        }
        return pageNum to pageSize
    }

    private fun json(body: String): ResponseEntity<String> =
        ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(body)
}
