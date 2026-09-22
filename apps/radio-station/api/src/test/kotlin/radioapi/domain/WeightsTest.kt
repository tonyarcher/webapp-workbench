package radioapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class WeightsTest {
    @Test
    fun clampsAndFallsBack() {
        val canon = canonicalizeWeights(mapOf("hitGravity" to 70.4, "goldLeak" to "15", "extra" to 1))
        assertEquals(70, canon.hitGravity)
        assertEquals(15, canon.goldLeak)
        assertEquals(90, canonicalizeWeights(null).powerOrbitMin)
        assertEquals(60, canonicalizeWeights(mapOf("powerOrbitMin" to 1)).powerOrbitMin)
        assertEquals(150, canonicalizeWeights(mapOf("powerOrbitMin" to 900)).powerOrbitMin)
        assertEquals(70, canonicalizeWeights(mapOf("hitGravity" to Double.POSITIVE_INFINITY)).hitGravity)
        assertTrue(weightsJson(DEFAULT_WEIGHTS).contains("\"hitGravity\":70"))
    }
}
