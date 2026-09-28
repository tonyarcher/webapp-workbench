package userapi

import org.junit.jupiter.api.Test
import java.io.ByteArrayOutputStream
import java.io.PrintStream
import java.time.Clock
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * The prod profile runs the framework at WARN, so without these lines a slow boot
 * is indistinguishable from a hang: nothing is logged between the banner and the
 * first request. These assert the line is actually emitted and carries the
 * duration, because a duration that is computed but never logged fixes nothing.
 */
class BootTimingTest {
    private val start: Instant = Instant.parse("2026-01-01T00:00:00Z")

    /** Moves only when told to, so a boot's span is exact rather than racy. */
    private class SteppingClock(private var now: Instant) : Clock() {
        override fun getZone(): ZoneId = ZoneOffset.UTC
        override fun withZone(zone: ZoneId): Clock = this
        override fun instant(): Instant = now
        fun advance(millis: Long) {
            now = now.plusMillis(millis)
        }
    }

    /** Both streams: the log helper sends warn and error to stderr, info to stdout. */
    private fun capture(block: () -> Unit): String {
        val out = ByteArrayOutputStream()
        val err = ByteArrayOutputStream()
        val originalOut = System.out
        val originalErr = System.err
        System.setOut(PrintStream(out, true, Charsets.UTF_8))
        System.setErr(PrintStream(err, true, Charsets.UTF_8))
        try {
            block()
        } finally {
            System.setOut(originalOut)
            System.setErr(originalErr)
        }
        return out.toString(Charsets.UTF_8) + err.toString(Charsets.UTF_8)
    }

    private fun failure(message: String) = IllegalStateException(message)

    @Test
    fun readyLogsOneInfoLineWithServiceAndStableMsg() {
        val out = capture { BootTiming(Clock.fixed(start, ZoneOffset.UTC)).ready() }
        val line = out.trim()

        assertEquals(1, line.lines().size, "exactly one line, got: $out")
        assertTrue("\"level\":\"info\"" in line, "startup must be info, got: $line")
        assertTrue("\"msg\":\"ready\"" in line, "msg must be a stable phrase, got: $line")
        assertTrue("\"service\":\"user-api\"" in line, "service must be set, got: $line")
    }

    @Test
    fun durationIsTheSpanSinceConstruction() {
        val clock = SteppingClock(start)
        val timing = BootTiming(clock)
        clock.advance(145_000)

        val line = capture { timing.ready() }.trim()

        assertTrue("\"duration_ms\":145000" in line, "expected the 145s span, got: $line")
    }

    @Test
    fun aBootThatJustStartedReportsZero() {
        val line = capture { BootTiming(Clock.fixed(start, ZoneOffset.UTC)).ready() }.trim()

        assertTrue("\"duration_ms\":0" in line, line)
    }

    @Test
    fun bootFailureIsAnErrorLineNamingTheCause() {
        val out = capture {
            BootTiming(Clock.fixed(start, ZoneOffset.UTC)).failed(failure("migration checksum mismatch"))
        }
        val line = out.trim()

        assertTrue("\"level\":\"error\"" in line, "a failed boot is an error, got: $line")
        assertTrue("\"msg\":\"boot_failed\"" in line, "got: $line")
        assertTrue("\"type\":\"IllegalStateException\"" in line, "cause type, got: $line")
    }

    @Test
    fun bootFailureKeepsTheMessageSoTheReasonIsGreppable() {
        val out = capture {
            BootTiming(Clock.fixed(start, ZoneOffset.UTC)).failed(failure("migration checksum mismatch"))
        }

        assertTrue("migration checksum mismatch" in out, "the reason must survive, got: $out")
    }

    @Test
    fun bootFailureCarriesItsOwnDuration() {
        val clock = SteppingClock(start)
        val timing = BootTiming(clock)
        clock.advance(12_000)

        val out = capture { timing.failed(failure("nope")) }

        assertTrue("\"duration_ms\":12000" in out, "got: $out")
    }
}
