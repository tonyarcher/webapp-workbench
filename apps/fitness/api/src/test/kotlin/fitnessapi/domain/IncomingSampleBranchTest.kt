package fitnessapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class IncomingSampleBranchTest {
    @Test
    fun asSampleBranches() {
        assertNull(asSample(null, 1.0, 1.0, "csv", "o1"))
        assertNull(asSample("body_mass", null, 1.0, "csv", "o1"))
        assertNull(asSample("body_mass", 1.0, null, "csv", "o1"))
        assertNull(asSample("body_mass", Double.NaN, 1.0, "csv", "o1"))
        assertNull(asSample("body_mass", 1.0, Double.POSITIVE_INFINITY, "csv", "o1"))
        assertNull(asSample("body_mass", 1.0, 1.0, "csv", null))
        assertNull(asSample("body_mass", 1.0, 1.0, "csv", ""))
        assertNull(asSample("nope-not-a-metric", 1.0, 1.0, "csv", "o1"))
        val ok = asSample("body_mass", 1.0, 70.0, null, "o1")
        assertTrue(ok != null && ok.metric == "body_mass")
    }

    @Test
    fun collectCapsErrors() {
        val items = List(25) { null } + listOf(asSample("body_mass", 1.0, 1.0, "csv", "o1"))
        val collected = collectSamples(items)
        assertEquals(25, collected.errorCount)
        assertEquals(20, collected.errors.size)
        assertEquals(1, collected.samples.size)
    }

    @Test
    fun collectDedups() {
        val a = asSample("body_mass", 1.0, 1.0, "csv", "o1")!!
        val b = asSample("body_mass", 1.0, 2.0, "csv", "o1")!!
        val collected = collectSamples(listOf(a, b))
        assertEquals(0, collected.errorCount)
        assertEquals(1, collected.samples.size)
        assertEquals(2.0, collected.samples[0].valueSi)
    }
}
