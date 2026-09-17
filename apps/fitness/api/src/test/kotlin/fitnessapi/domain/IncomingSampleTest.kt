package fitnessapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class IncomingSampleTest {
    @Test
    fun collectDedupsAndCountsInvalid() {
        val ok = asSample("weight", 100.0, 80.0, "csv", "a")
        val dup = asSample("body_mass", 100.0, 81.0, "csv", "a")
        val bad = asSample("nope", 1.0, 1.0, "csv", "b")
        val collected = collectSamples(listOf(ok, dup, bad, null))
        assertEquals(1, collected.samples.size)
        assertEquals(81.0, collected.samples[0].valueSi)
        assertEquals(2, collected.errorCount)
        assertEquals(listOf("invalid sample", "invalid sample"), collected.errors)
        assertNull(asSample("body_mass", 1.0, 1.0, "csv", ""))
    }
}
