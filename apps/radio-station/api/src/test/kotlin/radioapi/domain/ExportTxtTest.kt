package radioapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ExportTxtTest {
    @Test
    fun formatsAWeekHeader() {
        val start = 1_788_220_800_000L
        val txt = formatPlaylistTxt(
            TxtInput(
                stationName = "Pulse 101",
                seed = "autumn-oak",
                weights = DEFAULT_WEIGHTS,
                timeZone = "UTC",
                entries = listOf(
                    TxtEntry(start, "The Chartliners", "Neon Boulevard"),
                    TxtEntry(start + 180_000, "Luna Vox", "Midnight Static"),
                ),
            ),
        )
        assertTrue(txt.startsWith("Pulse 101 — 2026-09-01 to 2026-09-08\n"))
        assertTrue(txt.contains("seed: autumn-oak"))
        assertTrue(txt.contains("hitGravity=70 goldLeak=15 temperature=40 separation=60 powerOrbitMin=90"))
        assertTrue(txt.contains("2026-09-01 00:00  The Chartliners — Neon Boulevard"))
        assertTrue(txt.contains("2026-09-01 00:03  Luna Vox — Midnight Static"))
    }

    @Test
    fun emptyEntriesStillHaveAHeader() {
        val txt = formatPlaylistTxt(TxtInput("Pulse 101", "x", DEFAULT_WEIGHTS, emptyList(), "UTC"))
        assertTrue(txt.startsWith("Pulse 101 —  to \nseed: x\n"))
        assertTrue(txt.endsWith("\n"))
    }
}
