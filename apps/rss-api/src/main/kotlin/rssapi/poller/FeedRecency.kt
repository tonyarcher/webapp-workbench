package rssapi.poller

import java.time.Duration
import java.time.Instant

/**
 * Login-recency gate for the batch poller.
 *
 * The poller tick runs on its own schedule for every subscriber; it does not
 * wait for a user to open the app. Feeds whose subscribers all went quiet get
 * a Fibonacci backoff (1, 2, 3, 5 days per extra quiet week) and stop entirely
 * after a month. A feed with at least one recently seen subscriber keeps the
 * normal poll interval. Unknown recency (null) stays eligible so legacy rows
 * and brand-new users are never starved.
 */
object FeedRecency {
    const val ACTIVE_DAYS = 7L
    const val STOP_DAYS = 30L
    private val FIB_DAYS = listOf(1L, 2L, 3L, 5L)

    /**
     * Return how stale a feed must be before it is due, or null to skip it.
     *
     * @param maxLastSeen most recent login among the feed subscribers, null when unknown.
     * @param baseMs normal staleness for active feeds (POLL_MAX_AGE_MS).
     */
    fun intervalFor(maxLastSeen: Instant?, now: Instant, baseMs: Long): Long? {
        if (maxLastSeen == null) return baseMs
        var inactiveDays = Duration.between(maxLastSeen, now).toDays()
        if (inactiveDays < 0) inactiveDays = 0
        if (inactiveDays <= ACTIVE_DAYS) return baseMs
        if (inactiveDays > STOP_DAYS) return null
        val week = ((inactiveDays - 1) / ACTIVE_DAYS).toInt()
        val fibIndex = (week - 1).coerceIn(0, FIB_DAYS.size - 1)
        return Duration.ofDays(FIB_DAYS[fibIndex]).toMillis()
    }
}
