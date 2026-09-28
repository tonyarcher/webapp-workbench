package userapi.web

import userapi.http.RateLimitCounter
import userapi.http.RateLimiter
import java.time.Instant

/**
 * Counter that reports a fixed count, so [RateLimiter]'s limit is the only
 * thing a route test exercises. The real counter needs Postgres, and the window
 * arithmetic it owns is covered against Postgres separately.
 */
class FixedRateLimitCounter(private val hits: Int = 1) : RateLimitCounter {
    override fun recordHit(key: String, now: Instant, windowMs: Long): Int = hits
}

/** A limiter that blocks only when the count exceeds [limit]. */
fun testLimiter(limit: Int): RateLimiter =
    RateLimiter(counter = FixedRateLimitCounter(), limit = limit, windowMs = 60_000L)
