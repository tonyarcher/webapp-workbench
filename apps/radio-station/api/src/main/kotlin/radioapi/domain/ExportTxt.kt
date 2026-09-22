package radioapi.domain

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

data class TxtEntry(val startsAt: Long, val artist: String, val title: String)

data class TxtInput(
    val stationName: String,
    val seed: String,
    val weights: Weights,
    val entries: List<TxtEntry>,
    val timeZone: String,
)

fun formatPlaylistTxt(input: TxtInput): String {
    val zone = ZoneId.of(input.timeZone)
    val first = input.entries.firstOrNull()
    val start = if (first == null) "" else ymd(first.startsAt, zone)
    val end = if (first == null) "" else ymd(first.startsAt + WEEK_MS, zone)
    val header = txtHeader(input, start, end)
    val rows = input.entries.map { entry ->
        "${ymd(entry.startsAt, zone)} ${hm(entry.startsAt, zone)}  ${entry.artist} — ${entry.title}"
    }
    return header + rows.joinToString("\n") + "\n"
}

private fun txtHeader(input: TxtInput, start: String, end: String): String {
    val weights = input.weights
    return "${input.stationName} — $start to $end\n" +
        "seed: ${input.seed}\n" +
        "hitGravity=${weights.hitGravity} goldLeak=${weights.goldLeak} " +
        "temperature=${weights.temperature} separation=${weights.separation} " +
        "powerOrbitMin=${weights.powerOrbitMin}\n\n"
}

private fun ymd(ms: Long, zone: ZoneId): String =
    DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(zone).format(Instant.ofEpochMilli(ms))

private fun hm(ms: Long, zone: ZoneId): String =
    DateTimeFormatter.ofPattern("HH:mm").withZone(zone).format(Instant.ofEpochMilli(ms))
