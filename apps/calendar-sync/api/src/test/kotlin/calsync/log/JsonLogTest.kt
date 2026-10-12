package calsync.log

import org.junit.jupiter.api.Test
import java.io.ByteArrayOutputStream
import java.io.PrintStream
import java.time.Instant
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class JsonLogTest {
    private val now: Instant = Instant.parse("2026-10-12T00:00:00Z")

    @Test
    fun levelsFallBackToInfo() {
        assertEquals("debug", parseLogLevel("DEBUG"))
        assertEquals("info", parseLogLevel("nope"))
    }

    @Test
    fun lineCarriesServiceLevelMsgAndExtra() {
        val line = formatLog("svc", "info", "hello", mapOf("n" to 3, "gone" to null), now = now)!!
        assertTrue(line.contains("\"service\":\"svc\""))
        assertTrue(line.contains("\"level\":\"info\""))
        assertTrue(line.contains("\"msg\":\"hello\""))
        assertTrue(line.contains("\"n\":3"))
        assertFalse(line.contains("gone"))
        assertTrue(line.contains("\"ts\":\"2026-10-12T00:00:00.000Z\""))
    }

    @Test
    fun mapExtraAndScalarKinds() {
        val line = formatLog(
            "svc",
            "warn",
            "mix",
            mapOf("flag" to true, "name" to "x", "nested" to mapOf("k" to 1)),
            now = now,
        )!!
        assertTrue(line.contains("\"flag\":true"))
        assertTrue(line.contains("\"name\":\"x\""))
        assertTrue(line.contains("\"nested\":{\"k\":1}"))
    }

    @Test
    fun belowThresholdReturnsNull() {
        assertNull(formatLog("svc", "info", "quiet", minLevel = "error", now = now))
        assertNull(formatLog("svc", "debug", "quiet", now = now))
        assertNotNull(formatLog("svc", "error", "loud", minLevel = "error", now = now))
    }

    private fun captured(
        out: ByteArrayOutputStream,
        err: ByteArrayOutputStream,
        block: () -> Unit,
    ): Pair<String, String> {
        val oldOut = System.out
        val oldErr = System.err
        System.setOut(PrintStream(out))
        System.setErr(PrintStream(err))
        try {
            block()
        } finally {
            System.setOut(oldOut)
            System.setErr(oldErr)
        }
        return out.toString() to err.toString()
    }

    @Test
    fun infoGoesToStdout() {
        val (out, err) = captured(ByteArrayOutputStream(), ByteArrayOutputStream()) {
            log("svc", "info", "hello", minLevel = "info")
        }
        assertTrue(out.contains("\"msg\":\"hello\""))
        assertTrue(err.isEmpty())
    }

    @Test
    fun errorGoesToStderr() {
        val (out, err) = captured(ByteArrayOutputStream(), ByteArrayOutputStream()) {
            log("svc", "error", "bad", minLevel = "info")
        }
        assertTrue(out.isEmpty())
        assertTrue(err.contains("\"level\":\"error\""))
    }

    @Test
    fun filteredLevelPrintsNothing() {
        val (out, err) = captured(ByteArrayOutputStream(), ByteArrayOutputStream()) {
            log("svc", "info", "quiet", minLevel = "error")
        }
        assertTrue(out.isEmpty())
        assertTrue(err.isEmpty())
    }
}
