package radioapi.web

import org.springframework.beans.factory.ObjectProvider
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import radioapi.domain.parseGenerate
import radioapi.service.EntryRow
import radioapi.service.GeneratedWeek
import radioapi.service.PlaylistRow
import radioapi.service.PlaylistWriter

@RestController
class PlaylistController(private val writers: ObjectProvider<PlaylistWriter>) {
    @PostMapping("/playlists", headers = ["X-Api-Version=1"])
    fun create(@RequestBody(required = false) body: Map<String, Any?>?): GeneratedWeek {
        val raw = body ?: emptyMap()
        val command = parseGenerate(raw.string("stationId"), raw.string("seed"), raw["startsAt"], raw.weights())
        return writers.orOffline().generate(command)
    }

    @GetMapping("/playlists/{id}", headers = ["X-Api-Version=1"])
    fun playlist(@PathVariable id: String): PlaylistRow = load(id)

    @GetMapping("/playlists/{id}/entries", headers = ["X-Api-Version=1"])
    fun entries(@PathVariable id: String): List<EntryRow> = writers.orOffline().entries(parsePlaylistId(id))
        ?: throw ApiException(HttpStatus.NOT_FOUND, "playlist not found")

    @GetMapping("/playlists/{id}/txt", headers = ["X-Api-Version=1"])
    fun txt(
        @PathVariable id: String,
        @RequestParam(name = "tz", required = false) tz: String?,
    ): ResponseEntity<String> {
        val playlist = load(id)
        val entries =
            writers.orOffline().entries(playlist.id) ?: throw ApiException(HttpStatus.NOT_FOUND, "playlist not found")
        return textFile(playlist, entries, tz)
    }

    private fun load(id: String): PlaylistRow = writers.orOffline().playlist(parsePlaylistId(id))
        ?: throw ApiException(HttpStatus.NOT_FOUND, "playlist not found")
}

private fun textFile(playlist: PlaylistRow, entries: List<EntryRow>, tz: String?): ResponseEntity<String> {
    val body = radioapi.domain.formatPlaylistTxt(txtInput(playlist, entries, requireTimeZone(tz)))
    val header = "attachment; filename=\"${playlist.seed}.txt\""
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType("text/plain;charset=UTF-8"))
        .header(HttpHeaders.CONTENT_DISPOSITION, header)
        .body(body)
}
