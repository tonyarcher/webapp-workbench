package radioapi.http

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class RequestIdsTest {
    @Test
    fun honorsHeaders() {
        val traced = requestIdsFrom(null, "00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01")
        assertEquals("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", traced.traceId)
        assertEquals("bbbbbbbbbbbbbbbb", traced.spanId)
        assertEquals("given", requestIdsFrom("given", null).requestId)
        assertNull(parseTraceparent("nope"))
        assertNull(parseTraceparent(null))
        assertEquals("made", requestIdsFrom("   ", "  ") { "made" }.requestId)
        assertEquals("made", requestIdsFrom("x".repeat(200), null) { "made" }.requestId)
    }
}
