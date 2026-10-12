package calsync.domain

import org.junit.jupiter.api.Test
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNull

class RequestIdsTest {
    private val trace = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"

    @Test
    fun traceparentParses() {
        val ids = parseTraceparent(trace)!!
        assertEquals("4bf92f3577b34da6a3ce929d0e0e4736", ids.requestId)
        assertEquals("4bf92f3577b34da6a3ce929d0e0e4736", ids.traceId)
        assertEquals("00f067aa0ba902b7", ids.spanId)
    }

    @Test
    fun traceparentRejects() {
        assertNull(parseTraceparent(null))
        assertNull(parseTraceparent("  "))
        assertNull(parseTraceparent("not-a-traceparent"))
    }

    @Test
    fun headerWins() {
        val ids = requestIdsFrom("req-1", trace)
        assertEquals("req-1", ids.requestId)
    }

    @Test
    fun blankHeaderFallsToTrace() {
        val ids = requestIdsFrom("  ", trace)
        assertEquals("4bf92f3577b34da6a3ce929d0e0e4736", ids.requestId)
    }

    @Test
    fun overlongHeaderIgnored() {
        val ids = requestIdsFrom("x".repeat(129), null, newId = { "gen" })
        assertEquals("gen", ids.requestId)
    }

    @Test
    fun missingEverythingGenerates() {
        val ids = requestIdsFrom(null, null)
        UUID.fromString(ids.requestId)
        assertNull(ids.traceId)
    }
}
