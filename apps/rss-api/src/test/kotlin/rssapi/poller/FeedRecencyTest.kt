package rssapi.poller

import java.time.Duration
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class FeedRecencyTest {
    private val now = Instant.parse("2026-09-12T00:00:00Z")
    private val base = 15 * 60_000L

    @Test
    fun activeWithinWeekKeepsBaseInterval() {
        val seen = now.minus(Duration.ofDays(7))
        assertEquals(base, FeedRecency.intervalFor(seen, now, base))
    }

    @Test
    fun unknownRecencyStaysEligible() {
        assertEquals(base, FeedRecency.intervalFor(null, now, base))
    }

    @Test
    fun quietWeeksBackOffByFibonacciDays() {
        assertEquals(Duration.ofDays(1).toMillis(), FeedRecency.intervalFor(now.minus(Duration.ofDays(8)), now, base))
        assertEquals(Duration.ofDays(2).toMillis(), FeedRecency.intervalFor(now.minus(Duration.ofDays(15)), now, base))
        assertEquals(Duration.ofDays(3).toMillis(), FeedRecency.intervalFor(now.minus(Duration.ofDays(22)), now, base))
        assertEquals(Duration.ofDays(5).toMillis(), FeedRecency.intervalFor(now.minus(Duration.ofDays(29)), now, base))
    }

    @Test
    fun quietBeyondMonthStops() {
        assertNull(FeedRecency.intervalFor(now.minus(Duration.ofDays(31)), now, base))
    }
}
