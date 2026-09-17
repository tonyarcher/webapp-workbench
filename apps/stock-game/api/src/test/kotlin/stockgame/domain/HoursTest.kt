package stockgame.domain

import java.time.Instant
import java.time.ZoneId
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class HoursTest {
    @Test
    fun openTimeReturnsNow() {
        val now = Instant.parse("2024-01-03T15:00:00Z").toEpochMilli()
        assertEquals(now, nextNyseOpen(now))
        assertTrue(isNyseOpen(now))
    }

    @Test
    fun preOpenSameDay() {
        val now = Instant.parse("2024-01-03T13:00:00Z").toEpochMilli()
        val next = nextNyseOpen(now)
        val z = Instant.ofEpochMilli(next).atZone(ZoneId.of("America/New_York"))
        assertEquals(9, z.hour)
        assertEquals(30, z.minute)
        assertTrue(next > now)
    }

    @Test
    fun fridayAfterCloseIsMonday() {
        val now = Instant.parse("2024-01-05T21:30:00Z").toEpochMilli()
        val next = nextNyseOpen(now)
        val z = Instant.ofEpochMilli(next).atZone(ZoneId.of("America/New_York"))
        assertEquals(9, z.hour)
        assertEquals(30, z.minute)
        assertEquals(8, z.dayOfMonth)
    }
}
