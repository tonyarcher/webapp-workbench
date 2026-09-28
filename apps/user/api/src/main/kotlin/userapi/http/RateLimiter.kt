package userapi.http

import java.time.Clock
import java.time.Instant

/** Default: 30 attempts per 10 minutes. */
private const val DEFAULT_WINDOW_MS = 10 * 60 * 1000L

/**
 * Counts attempts for a key and reports the total in the current window.
 *
 * A seam rather than a detail: the counter has to be shared state, because a
 * per-replica counter silently multiplies the limit by the replica count. Two
 * user-api containers would each allow 30 attempts, so the effective limit would
 * be 60 and a block would reset on whichever replica the client did not reach.
 */
fun interface RateLimitCounter {
    /** Count one attempt for [key]; returns hits so far in the window at [now]. */
    fun recordHit(key: String, now: Instant, windowMs: Long): Int
}

/**
 * Throttles repeated attempts against one key, e.g. a login name plus client IP.
 *
 * Only the threshold lives here. The window arithmetic is the counter's job and
 * has to happen in the same statement as the increment, or two replicas
 * interleaving a read and a write would each see the same count.
 */
class RateLimiter(
    private val counter: RateLimitCounter,
    private val limit: Int = 30,
    private val windowMs: Long = DEFAULT_WINDOW_MS,
    private val clock: Clock = Clock.systemUTC(),
) {
    fun allow(key: String): Boolean = counter.recordHit(key, clock.instant(), windowMs) <= limit
}
