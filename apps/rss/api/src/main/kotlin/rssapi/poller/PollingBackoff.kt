package rssapi.poller

import java.time.Instant

/**
 * Failed feeds back off instead of being retried every poll tick. The delays
 * are absolute so they do not depend on the caller's poll interval: a dead
 * source settles at one attempt a day, and a single transient error costs one
 * half-hour retry. A successful fetch clears the count.
 */
object PollingBackoff {
    private const val MINUTE_MS = 60_000L
    private val STEPS_MS = longArrayOf(
        30 * MINUTE_MS,
        60 * MINUTE_MS,
        3 * 60 * MINUTE_MS,
        6 * 60 * MINUTE_MS,
        12 * 60 * MINUTE_MS,
        24 * 60 * MINUTE_MS,
    )

    fun delayFor(failures: Int): Long {
        val index = if (failures <= 1) 0 else (failures - 1).coerceAtMost(STEPS_MS.lastIndex)
        return STEPS_MS[index]
    }

    fun nextAttempt(failures: Int, now: Instant): Instant = now.plusMillis(delayFor(failures))
}
