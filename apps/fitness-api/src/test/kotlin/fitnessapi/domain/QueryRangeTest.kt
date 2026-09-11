package fitnessapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals

class QueryRangeTest {
    @Test
    fun clampsLimitAndMillis() {
        assertEquals(2_000, clampLimit(null))
        assertEquals(2_000, clampLimit(Double.NaN))
        assertEquals(1, clampLimit(0.0))
        assertEquals(5_000, clampLimit(9_000.0))
        assertEquals(0L, queryMillis(null, 0L))
        assertEquals(50L, queryMillis(50.9, 0L))
    }
}
