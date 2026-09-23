package radioapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PickTest {
    private val now = 1_000_000L
    private val windows = separationWindows(100)

    @Test
    fun goldLeakAndEmptyPicks() {
        val always = Rng("gold")
        val bucket = chooseBucket(always, DEFAULT_WEIGHTS.copy(goldLeak = 100))
        assertTrue(bucket == "gold2000s" || bucket == "gold1990s")
        assertFailsWith<IllegalStateException> { pickWeighted(Rng("x"), emptyList<String>(), emptyList()) }
        assertFailsWith<IllegalStateException> { pickUniform(Rng("x"), emptyList<String>()) }
    }

    @Test
    fun temperatureZeroPicksTheMostDue() {
        val due = track("due", rank = 1)
        val fresh = track("fresh", rank = 1)
        val picked = pickFromBucket(
            Rng("temp"),
            buckets(current = listOf(fresh, due)),
            "current",
            now,
            mapOf("fresh" to now),
            emptyMap(),
            windows,
            temperature = 0,
        )
        assertEquals("due", picked.id)
    }

    @Test
    fun emptyBucketFallsBack() {
        val picked = pickFromBucket(
            Rng("fall"),
            buckets(power = listOf(track("only"))),
            "current",
            now,
            emptyMap(),
            emptyMap(),
            windows,
            temperature = 100,
        )
        assertEquals("only", picked.id)
    }

    @Test
    fun artistSeparationBlocks() {
        val song = track("song", artist = "Same")
        val blocked = passesSeparation(
            song,
            now,
            emptyMap(),
            mapOf("Same" to now - 1_000),
            windows,
            0.0,
        )
        assertFalse(blocked)
        val orbit = orbitPolicy(DEFAULT_WEIGHTS)
        assertFalse(shouldForceNumberOne(null, now, 0, emptyMap(), emptyMap(), windows, orbit, 0))
        assertFalse(shouldForceNumberOne(song, now, 0, emptyMap(), emptyMap(), windows, orbit, 100))
    }
}

private fun track(id: String, artist: String = id, rank: Int = 2): Track = Track(
    id = id,
    artist = artist,
    title = id,
    durationMs = 180_000,
    year = 2024,
    genre = "pop",
    era = "current",
    rotation = "current",
    rank = rank,
    explicit = false,
    radioEdit = true,
)

private fun buckets(power: List<Track> = emptyList(), current: List<Track> = emptyList()) = TrackBuckets(
    power,
    current,
    emptyList(),
    emptyList(),
    emptyList(),
)
