package fitnessapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class MetricsTest {
    @Test
    fun mapsAliases() {
        assertEquals("body_mass", parseMetricId("weight"))
        assertEquals("body_mass", parseMetricId(" Body-Mass "))
        assertEquals("energy_total", parseMetricId("energy"))
        assertEquals("heart_rate", parseMetricId("hr"))
        assertEquals("upper_arm", parseMetricId("bicep"))
        assertNull(parseMetricId("not-a-metric"))
    }
}
