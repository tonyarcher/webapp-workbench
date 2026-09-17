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
    fun invalidLinkFallsBackToInput() {
        assertEquals("not a url", normalizeLink("not a url"))
    }

    @Test
    fun popularityAndHot() {
        assertEquals(1.0, popularityScore(1, 0))
        assertEquals(4.0, popularityScore(2, 0))
        assertEquals(63.0, popularityScore(5, 100))
        val hot = hotScore(1.0, 0.0, 1_700_000_000_000L)
        assertTrue(hot > 0)
        assertTrue(hotScore(0.0, -5.0, 0L) < hot)
    }

    @Test
    fun affinityAndVelocity() {
        assertEquals(0.0, affinityBoostScore(-1.0))
        assertTrue(affinityBoostScore(100.0) <= 4.0)
        assertEquals(0.0, velocityBonus(3, null))
        assertEquals(0.0, velocityBonus(3, -1L))
        assertEquals(0.0, velocityBonus(3, 100_000_000L))
        assertTrue(velocityBonus(10, 1_000L) > 0)
    }

    @Test
    fun queryVariants() {
        assertEquals("example.com/a", normalizeLink("https://example.com/a?utm_source=x"))
        assertEquals("example.com/a?x=1&y=2", normalizeLink("https://example.com/a?x=1&utm_medium=y&y=2"))
        assertEquals("example.com", normalizeLink("https://example.com/"))
    }

    @Test
    fun firstImages() {
        assertEquals(null, firstImageUrl(null))
        assertEquals(null, firstImageUrl(""))
        assertEquals(null, firstImageUrl("<p>no images</p>"))
        assertEquals(
            "https://example.com/l.png",
            firstImageUrl("<img data-src=\"https://example.com/l.png\" src=\"https://example.com/s.png\">"),
        )
        assertEquals("https://example.com/s.png", firstImageUrl("<img src=\"https://example.com/s.png\">"))
        assertEquals(
            "https://example.com/a.png",
            firstImageUrl("<img srcset=\"https://example.com/a.png 1x, https://example.com/b.png 2x\">"),
        )
        assertEquals(null, firstImageUrl("<img srcset=\"   \">"))
        assertEquals(null, firstImageUrl("<img src=\"javascript:alert(1)\">"))
    }
}
