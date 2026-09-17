package fitnessapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class PointEdgeTest {
    @Test
    fun smallInputsReturnCopies() {
        assertEquals(emptyList(), downsampleLttb(emptyList(), 10))
        val two = listOf(Point(1, 1.0), Point(2, 2.0))
        assertEquals(two, downsampleLttb(two, 10))
        assertEquals(two, downsampleLttb(two, 2))
        assertEquals(two, downsampleLttb(two, 0))
    }

    @Test
    fun downsamplesLargeSeries() {
        val many = (0 until 100).map { Point(it.toLong(), (it % 7).toDouble()) }
        val sampled = downsampleLttb(many, 10)
        assertTrue(sampled.size <= 10)
        assertEquals(many.first(), sampled.first())
        assertEquals(many.last(), sampled.last())
    }

    @Test
    fun queryHelpers() {
        assertEquals(5, clampLimit(5.0))
        assertEquals(5_000, clampLimit(99_999.0))
        assertEquals(2_000, clampLimit(null))
        assertEquals(2_000, clampLimit(Double.NaN))
        assertEquals(1, clampLimit(0.0))
        assertEquals(0L, queryMillis("abc".toDoubleOrNull(), 0L))
        assertEquals(7L, queryMillis(7.0, 0L))
    }
}
