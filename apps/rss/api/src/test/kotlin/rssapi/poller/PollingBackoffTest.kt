package rssapi.poller
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals

class PollingBackoffTest {
    @Test
    fun firstFailureWaitsHalfAnHour() {
        assertEquals(30 * 60_000L, PollingBackoff.delayFor(1))
        assertEquals(30 * 60_000L, PollingBackoff.delayFor(0))
        assertEquals(30 * 60_000L, PollingBackoff.delayFor(-2))
    }

    @Test
    fun repeatedFailuresGrowThenCap() {
        val delays = (1..12).map { PollingBackoff.delayFor(it) }
        assertEquals(delays.sorted(), delays)
        assertEquals(24 * 60 * 60_000L, delays.last())
    }

    @Test
    fun nextAttemptAddsTheDelay() {
        val now = Instant.parse("2026-11-20T10:00:00Z")
        assertEquals(Instant.parse("2026-11-20T10:30:00Z"), PollingBackoff.nextAttempt(1, now))
        assertEquals(Instant.parse("2026-11-21T10:00:00Z"), PollingBackoff.nextAttempt(12, now))
    }
}
