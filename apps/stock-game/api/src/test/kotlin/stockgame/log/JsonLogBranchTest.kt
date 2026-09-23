package stockgame.log

import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class JsonLogBranchTest {
    private val now = Instant.parse("2026-01-01T00:00:00Z")

    @Test
    fun levels() {
        assertEquals("debug", parseLogLevel("DEBUG"))
        assertEquals("info", parseLogLevel("nope"))
    }

    @Test
    fun filteredBelowMin() {
        assertNull(formatLog("s", "debug", "m", minLevel = "info", now = now))
        assertTrue(formatLog("s", "error", "m", minLevel = "info", now = now) != null)
    }

    @Test
    fun extrasAndNulls() {
        val line =
            formatLog(
                "s",
                "info",
                "m",
                mapOf(
                    "a" to 1,
                    "b" to true,
                    "c" to "x",
                    "n" to null,
                    "m" to mapOf(1 to "x", "k" to "v", "nil" to null),
                ),
                now = now,
            )
        val text = assertNotNull(line)
        assertTrue(text.contains("\"a\":1"))
        assertTrue(text.contains("\"service\":\"s\""))
    }

    @Test
    fun logSinks() {
        log("s", "info", "out")
        log("s", "warn", "err")
        log("s", "debug", "hidden", minLevel = "error")
    }
}
