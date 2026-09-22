package radioapi.web

import java.time.DateTimeException
import java.time.ZoneId
import java.util.UUID
import radioapi.domain.TxtEntry
import radioapi.domain.TxtInput
import radioapi.service.EntryRow
import radioapi.service.PlaylistRow

fun parsePlaylistId(id: String): UUID = try {
    UUID.fromString(id)
} catch (_: IllegalArgumentException) {
    throw ApiException(400, "invalid playlist id")
}

fun requireTimeZone(raw: String?): String {
    val zone = raw ?: "UTC"
    try {
        ZoneId.of(zone)
    } catch (_: DateTimeException) {
        throw ApiException(400, "invalid time zone")
    }
    return zone
}

fun txtInput(playlist: PlaylistRow, entries: List<EntryRow>, zone: String): TxtInput = TxtInput(
    stationName = playlist.stationName,
    seed = playlist.seed,
    weights = playlist.weights,
    entries = entries.map { TxtEntry(it.startsAt, it.artist, it.title) },
    timeZone = zone,
)

fun Map<String, Any?>.string(key: String): String? = this[key] as? String

@Suppress("UNCHECKED_CAST")
fun Map<String, Any?>.weights(): Map<String, Any?>? = this["weights"] as? Map<String, Any?>
