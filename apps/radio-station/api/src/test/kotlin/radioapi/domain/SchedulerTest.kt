package radioapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class SchedulerTest {
    @Test
    fun weekReplaysIdenticallyAndRunsWithoutGaps() {
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

/**
 * A synthetic catalog with the same shape as the seeded one, built here rather
 * than scraped out of the migration.
 *
 * The previous version read `V2__seed_catalog.sql` and pulled rows out with a
 * positional regex. That regex was also off by two columns: it assigned
 * `era = groupValues[6]` and `rotation = groupValues[7]`, which are actually
 * the genre and the era, so every track was given a rotation of "gold-2000s"
 * or "current" and the test passed against data that does not exist in
 * production. Hardcoding genre to "pop" hid the mistake.
 *
 * The distribution below mirrors the seed on purpose, because two of its
 * properties are contracts the scheduler relies on:
 *
 *  - the gold era appears only on gold tracks, so the gold buckets the picker
 *    reaches under a high goldLeak really do contain nothing but gold;
 *  - the power rotation contains a rank 1, which the orbit test selects.
 */
private data class Shape(val rotation: String, val era: String, val count: Int)

private val SHAPE = listOf(
    Shape("power", "current", 8),
    Shape("current", "current", 16),
    Shape("recurrent", "recurrent", 12),
    Shape("gold", "gold-2000s", 12),
    Shape("gold", "gold-1990s", 8),
)

private fun catalog(): List<Track> {
    val artists = (1..14).map { "artist-$it" }
    val tracks = mutableListOf<Track>()
    var n = 0
    for (group in SHAPE) {
        var rank = 0
        repeat(group.count) { index ->
            n += 1
            if (group.rotation == "power") rank = index + 1
            tracks += track(n, group, rank, artists)
        }
    }
    return tracks
}

private fun track(n: Int, group: Shape, powerRank: Int, artists: List<String>): Track = Track(
    id = "00000000-0000-4000-8000-%012d".format(n),
    artist = artists[(n - 1) % artists.size],
    title = "track-$n",
    durationMs = 180_000 + (n % 6) * 12_000,
    year = 1988 + (n % 38),
    genre = "pop",
    era = group.era,
    rotation = group.rotation,
    rank = if (group.rotation == "power") powerRank else 1 + (n % 5),
    explicit = n % 11 == 0,
    radioEdit = true,
)
