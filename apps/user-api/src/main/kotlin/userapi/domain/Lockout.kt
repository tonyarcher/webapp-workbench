package userapi.domain

import java.time.Duration
import java.time.Instant

const val LOCKOUT_FAILURES = 5
val LOCKOUT_DURATION: Duration = Duration.ofMinutes(15)

data class LockoutState(
    val failedLogins: Int,
    val lockedUntil: Instant?,
)

fun isLocked(now: Instant, lockedUntil: Instant?): Boolean {
    return lockedUntil != null && now.isBefore(lockedUntil)
}

fun recordFailure(now: Instant, failedLogins: Int): LockoutState {
    val next = failedLogins + 1
    val until = if (next >= LOCKOUT_FAILURES) now.plus(LOCKOUT_DURATION) else null
    return LockoutState(next, until)
}

fun clearFailures(): LockoutState = LockoutState(0, null)
