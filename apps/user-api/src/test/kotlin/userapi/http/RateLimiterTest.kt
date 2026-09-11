package userapi.http

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class RateLimiterTest {
    @Test
    fun blocksAfterLimit() {
        var now = 1_000L
        val limiter = RateLimiter(limit = 2, windowMs = 1_000L, nowMs = { now })
        assertTrue(limiter.allow("ip"))
        assertTrue(limiter.allow("ip"))
        assertFalse(limiter.allow("ip"))
        now = 3_000L
        assertTrue(limiter.allow("ip"))
    }
}
