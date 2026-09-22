package radioapi.log

import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class JsonLogTest {
    @Test
    fun formatsAndFilters() {
        val now = Instant.parse("2026-09-01T00:00:00Z")
        val line = formatLog("radio-api", "info", "listening", mapOf("port" to 3002), "info", now)
        assertTrue(line!!.contains("\"service\":\"radio-api\""))
        assertTrue(line.contains("\"port\":3002"))
        assertNull(formatLog("radio-api", "debug", "x", minLevel = "error", now = now))
        assertEquals("info", parseLogLevel("nope"))
        log("radio-api", "warn", "slow", mapOf("err" to mapOf("type" to "X", "n" to null)), "debug")
        log("radio-api", "error", "down", mapOf("ok" to false, "n" to 1, "tags" to listOf("a")), "debug")
        log("radio-api", "debug", "hidden", minLevel = "error")
        val skipped = formatLog("radio-api", "info", "x", mapOf("skip" to null), "info", now)
        assertTrue(skipped!!.contains("skip").not())
    }
}
