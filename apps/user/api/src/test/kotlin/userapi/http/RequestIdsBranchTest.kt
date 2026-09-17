package userapi.http

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class RequestIdsBranchTest {
    @Test
    fun incomingOrGenerated() {
        assertEquals("req-1", requestIdsFrom("req-1", null, newId = { "gen" }).requestId)
        assertEquals("gen", requestIdsFrom("  ", null, newId = { "gen" }).requestId)
        assertEquals("gen", requestIdsFrom("x".repeat(200), null, newId = { "gen" }).requestId)
    }

    @Test
    fun traceparentPaths() {
        val tp = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
        val ids = requestIdsFrom(null, tp, newId = { "gen" })
        assertEquals("4bf92f3577b34da6a3ce929d0e0e4736", ids.traceId)
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
