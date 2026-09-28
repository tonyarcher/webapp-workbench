package userapi.http

import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class RateLimiterTest {
    /** Stands in for the shared counter: counts per key, window reset included. */
    private class FakeCounter : RateLimitCounter {
        val calls = mutableListOf<Triple<String, Instant, Long>>()
        var hits = 1

        override fun recordHit(key: String, now: Instant, windowMs: Long): Int {
            calls += Triple(key, now, windowMs)
            return hits
        }
    }

    private fun limiter(counter: RateLimitCounter, limit: Int, at: Instant) = RateLimiter(
        counter = counter,
        limit = limit,
        windowMs = 1_000L,
        clock = Clock.fixed(at, ZoneOffset.UTC),
    )

    @Test
    fun allowsUpToTheLimitThenBlocks() {
        val counter = FakeCounter()
        val at = Instant.ofEpochMilli(1_000L)
        counter.hits = 2
        assertTrue(limiter(counter, limit = 2, at = at).allow("ip"))
        counter.hits = 3
        assertFalse(limiter(counter, limit = 2, at = at).allow("ip"))
    }

    @Test
    fun passesTheKeyAndWindowToTheCounter() {
        val counter = FakeCounter()
        val at = Instant.ofEpochMilli(5_000L)
        limiter(counter, limit = 30, at = at).allow("login:10.0.0.9")
        assertEquals("login:10.0.0.9", counter.calls.single().first)
        assertEquals(at, counter.calls.single().second)
        assertEquals(1_000L, counter.calls.single().third)
    }

    /**
     * The default is a security threshold, so pin it: a change that quietly
     * raises the attempt budget would otherwise pass every other test here.
     */
    @Test
    fun defaultLimitIsThirtyPerWindow() {
        val counter = FakeCounter()
        val at = Instant.ofEpochMilli(1_000L)
        counter.hits = 30
        assertTrue(RateLimiter(counter, clock = Clock.fixed(at, ZoneOffset.UTC)).allow("ip"))
        counter.hits = 31
        assertFalse(RateLimiter(counter, clock = Clock.fixed(at, ZoneOffset.UTC)).allow("ip"))
    }
}
