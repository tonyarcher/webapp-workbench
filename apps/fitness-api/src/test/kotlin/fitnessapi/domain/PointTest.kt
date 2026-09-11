package fitnessapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class PointTest {
    @Test
    fun lttbKeepsEndsAndShortLists() {
        val points = (0L until 10).map { Point(it * 10, it.toDouble()) }
        assertEquals(points, downsampleLttb(points, 20))
        val down = downsampleLttb(points, 4)
        assertTrue(down.size in 2..4)
        assertEquals(points.first(), down.first())
        assertEquals(points.last(), down.last())
    }
}
