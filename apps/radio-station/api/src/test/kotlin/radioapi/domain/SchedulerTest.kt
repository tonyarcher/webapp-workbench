package radioapi.domain

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class SchedulerTest {
    @Test
    fun weekReplaysAndCoversTheCatalog() {
        val tracks = catalog()
        val first = week(tracks, "autumn-oak", DEFAULT_WEIGHTS)
        val second = week(tracks, "autumn-oak", DEFAULT_WEIGHTS)
        assertTrue(first.size > 1000)
        assertEquals(ids(first), ids(second))
        assertEquals(START, first.first().startsAtMs)
        val last = first.last()
        assertTrue(last.startsAtMs + last.durationMs >= START + WEEK_MS)
        assertContinuous(first)
    }

    @Test
    fun knobsChangeTheClock() {
        val tracks = catalog()
        val hot = week(tracks, "autumn-oak", DEFAULT_WEIGHTS.copy(temperature = 0))
        val wild = week(tracks, "autumn-oak", DEFAULT_WEIGHTS.copy(temperature = 100))
        assertTrue(ids(hot) != ids(wild))
        assertTrue(week(tracks, "jukebox-off", DEFAULT_WEIGHTS.copy(goldLeak = 0)).all { it.rotation != "gold" })
        assertTrue(week(tracks, "jukebox-on", DEFAULT_WEIGHTS.copy(goldLeak = 100)).all { it.rotation == "gold" })
    }

    @Test
    fun separationAndOrbitHold() {
        val tracks = catalog()
        val separated = week(tracks, "far-apart", DEFAULT_WEIGHTS.copy(separation = 100, goldLeak = 0))
        assertTrue(separated.zipWithNext().none { (prev, cur) -> prev.artist == cur.artist })
        val numberOne = tracks.first { it.rotation == "power" && it.rank == 1 }.id
        val orbit = DEFAULT_WEIGHTS.copy(powerOrbitMin = 90, goldLeak = 0, hitGravity = 100)
        val plays = week(tracks, "orbit-check", orbit)
            .filter { it.trackId == numberOne }
            .map { it.startsAtMs }
        assertTrue(plays.size > 40)
        val minGap = 0.7 * 90 * 60_000
        assertTrue(plays.zipWithNext().none { (prev, cur) -> cur - prev + 1 < minGap })
    }

    @Test
    fun emptyAndZeroDurationFail() {
        assertFailsWith<IllegalStateException> { generateWeek(emptyList(), "x", START, DEFAULT_WEIGHTS) }
        val zero = catalog().first().copy(durationMs = 0)
        assertFailsWith<IllegalStateException> { generateWeek(listOf(zero), "x", START, DEFAULT_WEIGHTS) }
    }
}

private const val START = 1_756_684_800_000L

private fun week(tracks: List<Track>, seed: String, weights: Weights): List<ScheduledEntry> =
    generateWeek(tracks, seed, START, weights)

private fun ids(rows: List<ScheduledEntry>): String = rows.joinToString(",") { it.trackId }

private fun assertContinuous(rows: List<ScheduledEntry>) {
    rows.zipWithNext().forEach { (prev, cur) ->
        assertEquals(prev.startsAtMs + prev.durationMs, cur.startsAtMs)
    }
}

private fun catalog(): List<Track> {
    val text = File("src/main/resources/db/migration/V2__seed_catalog.sql").readText()
    val pattern = Regex(
        "\\('([0-9a-f-]+)', '([^']*)', '((?:[^']|'')*)', (\\d+), (\\d+), 'pop', '([^']+)', '([^']+)', (\\d+),",
    )
    return pattern.findAll(text).map { match ->
        Track(
            id = match.groupValues[1],
            artist = match.groupValues[2].replace("''", "'"),
            title = match.groupValues[3].replace("''", "'"),
            durationMs = match.groupValues[4].toInt(),
            year = match.groupValues[5].toInt(),
            genre = "pop",
            era = match.groupValues[6],
            rotation = match.groupValues[7],
            rank = match.groupValues[8].toInt(),
            explicit = false,
            radioEdit = true,
        )
    }.toList()
}
