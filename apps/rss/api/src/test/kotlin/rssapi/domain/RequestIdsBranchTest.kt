package rssapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class RequestIdsBranchTest {
    @Test
    fun incomingOrGenerated() {
        val withHeader = requestIdsFrom("req-1", null, newId = { "gen" })
        assertEquals("req-1", withHeader.requestId)
        assertNull(withHeader.traceId)
        val blank = requestIdsFrom("  ", null, newId = { "gen" })
        assertEquals("gen", blank.requestId)
        val long = requestIdsFrom("x".repeat(200), null, newId = { "gen" })
        assertEquals("gen", long.requestId)
    }

    @Test
    fun traceparentPaths() {
        val tp = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
        val ids = requestIdsFrom(null, tp, newId = { "gen" })
        assertEquals("4bf92f3577b34da6a3ce929d0e0e4736", ids.traceId)
        assertEquals("00f067aa0ba902b7", ids.spanId)
        val upper = requestIdsFrom("r1", tp.uppercase(), newId = { "gen" })
        assertEquals("r1", upper.requestId)
        assertTrue(upper.traceId != null)
    }

    @Test
    fun badTraceparent() {
        assertNull(parseTraceparent(null))
        assertNull(parseTraceparent("  "))
        assertNull(parseTraceparent("nope"))
        assertNull(requestIdsFrom(null, "nope", newId = { "gen" }).traceId)
    }
}
