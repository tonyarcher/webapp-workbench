package radioapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class GenerateTest {
    @Test
    fun defaultsMidnightAndSeed() {
        val command = parseGenerate(null, null, null, null) { "fixed-seed" }
        assertEquals("top40", command.stationId)
        assertEquals("fixed-seed", command.seed)
        assertEquals(DEFAULT_WEIGHTS, command.weights)
        assertEquals(utcMidnightMs(1_756_684_800_000L + 3_600_000), utcMidnightMs(1_756_684_800_000L + 3_600_000))
    }

    @Test
    fun normalizesSeedAndRejectsBadStarts() {
        assertEquals("autumn-oak", normalizeSeed("  Autumn Oak! "))
        assertEquals("fallback", normalizeSeed("!!!") { "fallback" })
        assertEquals("amber-orbit", randomSeed { 0 })
        assertFailsWith<BadInput> { parseStartsAt("noon") }
        assertFailsWith<BadInput> { parseStartsAt(Double.NaN) }
    }
}
