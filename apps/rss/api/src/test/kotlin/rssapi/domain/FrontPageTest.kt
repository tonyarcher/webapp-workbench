package rssapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class FrontPageTest {
    @Test
    fun signalsAreDeterministic() {
        val first = signalWorthy(6_300.0, 4.0, 2.0, 3.0)
        assertEquals(first, signalWorthy(6_300.0, 4.0, 2.0, 3.0))
        assertEquals(signalInterest(6_300.0, 4.0, 2.0, 3.0), signalInterest(6_300.0, 4.0, 2.0, 3.0))
        assertEquals(
            signalPopularityOutlook(6_300.0, 4.0, 2.0, 3.0),
            signalPopularityOutlook(6_300.0, 4.0, 2.0, 3.0),
        )
        assertEquals(signalReadability(600), signalReadability(600))
    }

    @Test
    fun signalsStayInRange() {
        val inputs = listOf(-1e9, -5.0, 0.0, 3.0, 6_300.0, 1e9, Double.NaN, Double.POSITIVE_INFINITY)
        for (v in inputs) {
            assertTrue(signalWorthy(v, v, v, v) in 0.0..1.0, "worthy($v)")
            assertTrue(signalInterest(v, v, v, v) in 0.0..1.0, "interest($v)")
            assertTrue(signalPopularityOutlook(v, v, v, v) in 0.0..1.0, "outlook($v)")
        }
        assertTrue(signalWorthy(6_300.0, Double.NEGATIVE_INFINITY, 0.0, 0.0) in 0.0..1.0)
    }

    @Test
    fun worthyRewardsHeatPopularityAndAffinity() {
        val base = signalWorthy(6_300.0, 2.0, 1.0, 1.0)
        assertTrue(signalWorthy(6_310.0, 2.0, 1.0, 1.0) > base)
        assertTrue(signalWorthy(6_300.0, 20.0, 1.0, 1.0) > base)
        assertTrue(signalWorthy(6_300.0, 2.0, 9.0, 1.0) > base)
        assertTrue(signalWorthy(6_300.0, 2.0, 1.0, 30.0) > base)
    }

    @Test
    fun interestWeightsAffinityAboveHeat() {
        val heatGain = signalInterest(6_310.0, 2.0, 1.0, 1.0) - signalInterest(6_300.0, 2.0, 1.0, 1.0)
        val affinityGain = signalInterest(6_300.0, 2.0, 1.0, 20.0) - signalInterest(6_300.0, 2.0, 1.0, 1.0)
        assertTrue(affinityGain > heatGain)
    }

    @Test
    fun outlookRewardsMomentum() {
        val base = signalPopularityOutlook(6_300.0, 2.0, 1.0, 0.0)
        assertTrue(signalPopularityOutlook(6_300.0, 40.0, 1.0, 0.0) > base)
        assertTrue(signalPopularityOutlook(6_300.0, 2.0, 40.0, 0.0) > base)
    }

    @Test
    fun readabilityBands() {
        assertEquals(0.0, signalReadability(0))
        assertEquals(0.0, signalReadability(-50))
        val stub = signalReadability(50)
        assertTrue(stub > 0.0 && stub < 0.6)
        assertEquals(0.6, signalReadability(150))
        val feature = signalReadability(600)
        assertTrue(feature > 0.6 && feature < 1.0)
        assertEquals(1.0, signalReadability(1_200))
        val long = signalReadability(3_000)
        assertTrue(long < 1.0 && long > 0.0)
        assertEquals(0.0, signalReadability(100_000))
    }
}
