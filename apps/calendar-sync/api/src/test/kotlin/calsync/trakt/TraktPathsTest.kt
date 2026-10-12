package calsync.trakt

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class TraktPathsTest {
    @Test
    fun kinds() {
        assertTrue(isTraktKind("shows"))
        assertTrue(isTraktKind("movies"))
        assertFalse(isTraktKind("episodes"))
        assertFalse(isTraktKind(""))
        assertFalse(isTraktKind("SHOWS"))
    }

    @Test
    fun dates() {
        assertTrue(isTraktDate("2026-10-12"))
        assertFalse(isTraktDate("2026-1-2"))
        assertFalse(isTraktDate("tomorrow"))
        assertFalse(isTraktDate(""))
        assertFalse(isTraktDate("2026-10-12T00:00:00"))
    }

    @Test
    fun bounds() {
        assertTrue(isCalendarDays(1))
        assertTrue(isCalendarDays(33))
        assertFalse(isCalendarDays(0))
        assertFalse(isCalendarDays(34))
        assertTrue(isHistoryPage(1, 100))
        assertFalse(isHistoryPage(0, 100))
        assertFalse(isHistoryPage(1, 0))
        assertFalse(isHistoryPage(1, 101))
    }

    @Test
    fun builders() {
        assertEquals("/calendars/my/shows/2026-10-12/7", calendarShowsPath("2026-10-12", 7))
        assertEquals("/calendars/my/movies/2026-10-12/7", calendarMoviesPath("2026-10-12", 7))
        assertEquals("/sync/history/shows?page=2&limit=100", historyPath("shows", 2, 100))
        assertEquals("/oauth/device/code", DEVICE_CODE_PATH)
        assertEquals("/oauth/device/token", DEVICE_TOKEN_PATH)
        assertEquals("/oauth/token", REFRESH_TOKEN_PATH)
    }

    @Test
    fun expiryAddsSeconds() {
        assertEquals(1_001_000L, expiresAtMs(1_000L, 1_000L))
    }

    @Test
    fun expiryDefaultsToNow() {
        val before = System.currentTimeMillis()
        val at = expiresAtMs(60L)
        assertTrue(at >= before + 60_000L)
        assertTrue(at <= System.currentTimeMillis() + 60_000L)
    }
}
