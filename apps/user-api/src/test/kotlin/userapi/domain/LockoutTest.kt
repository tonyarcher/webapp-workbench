package userapi.domain

import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class LockoutTest {
    private val now = Instant.parse("2026-09-11T17:00:00Z")

    @Test
    fun locksOnFifthFailure() {
        val fourth = recordFailure(now, 3)
        assertEquals(4, fourth.failedLogins)
        assertEquals(null, fourth.lockedUntil)
        val fifth = recordFailure(now, 4)
        assertEquals(5, fifth.failedLogins)
        assertEquals(now.plus(LOCKOUT_DURATION), fifth.lockedUntil)
        assertTrue(isLocked(now.plusSeconds(60), fifth.lockedUntil))
        assertFalse(isLocked(now.plus(LOCKOUT_DURATION), fifth.lockedUntil))
    }

    @Test
    fun clearResets() {
        assertEquals(0, clearFailures().failedLogins)
        assertEquals(null, clearFailures().lockedUntil)
    }
}
