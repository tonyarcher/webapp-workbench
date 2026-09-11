package userapi.http

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class RequestIdsTest {
    @Test
    fun prefersRequestIdHeader() {
        val ids = requestIdsFrom("req-1", null) { "generated" }
        assertEquals("req-1", ids.requestId)
        assertNull(ids.traceId)
    }

    @Test
    fun parsesTraceparent() {
        val ids = requestIdsFrom(
            null,
            "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
        ) { "generated" }
        assertEquals("4bf92f3577b34da6a3ce929d0e0e4736", ids.requestId)
        assertEquals("4bf92f3577b34da6a3ce929d0e0e4736", ids.traceId)
        assertEquals("00f067aa0ba902b7", ids.spanId)
    }

    @Test
    fun generatesWhenMissing() {
        val ids = requestIdsFrom(null, "not-a-trace") { "generated" }
        assertEquals("generated", ids.requestId)
    }
}
