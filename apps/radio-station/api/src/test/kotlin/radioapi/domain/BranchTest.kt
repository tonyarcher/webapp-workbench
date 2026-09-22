package radioapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class BranchTest {
    @Test
    fun bucketsAndNumberOne() {
        val gold = track("g", era = "gold-1990s", rotation = "gold")
        val newer = track("n", era = "gold-2000s", rotation = "gold")
        val buckets = groupTracks(listOf(track("p", rotation = "power", rank = 2), gold, newer))
        assertEquals("g", buckets.gold1990s.single().id)
        assertEquals("n", buckets.gold2000s.single().id)
        assertEquals("p", numberOne(buckets)?.id)
        assertEquals("only", numberOne(groupTracks(listOf(track("only", rotation = "power", rank = 4))))?.id)
    }

    @Test
    fun orbitUsesLastPlay() {
        val song = track("top", rotation = "power", rank = 1)
        val windows = separationWindows(0)
        val orbit = orbitPolicy(DEFAULT_WEIGHTS.copy(powerOrbitMin = 60))
        val last = mapOf(song.id to 0L)
        val forced = shouldForceNumberOne(song, orbit.forceMs.toLong() + 1, 0, last, emptyMap(), windows, orbit, 0)
        assertTrue(forced)
        val blocked = shouldForceNumberOne(song, 1, 0, last, mapOf(song.artist to 1L), windows, orbit, 0)
        assertFalse(blocked)
    }

    @Test
    fun blankSeedAndEmptyStarts() {
        val command = parseGenerate("top40", "   ", "", mapOf("hitGravity" to "nope")) { "made" }
        assertEquals("made", command.seed)
        assertEquals(70, command.weights.hitGravity)
        assertEquals(0L, parseStartsAt(0))
    }
}

private fun track(
    id: String,
    era: String = "current",
    rotation: String = "current",
    rank: Int = 1,
) = Track(id, id, id, 180_000, 2024, "pop", era, rotation, rank, false, true)
