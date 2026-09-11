package rssapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class RankingTest {
    @Test
    fun stripsTrackingParams() {
        val n = normalizeLink("http://www.Example.com/a/?utm_source=x&id=1")
        assertEquals("example.com/a?id=1", n)
    }

    @Test
    fun popularityAndHot() {
        assertEquals(1.0, popularityScore(1, 0))
        assertEquals(4.0, popularityScore(2, 0))
        val hot = hotScore(1.0, 0.0, 1_700_000_000_000L)
        assertTrue(hot > 0)
    }
}
