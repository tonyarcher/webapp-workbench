package radioapi.web

import kotlin.test.Test
import kotlin.test.assertEquals
import radioapi.domain.BadInput
import radioapi.service.UnknownStation

class ErrorAdviceTest {
    private val advice = ErrorAdvice()

    @Test
    fun mapsKnownFailures() {
        val bad = advice.handleBad(BadInput("startsAt must be epoch milliseconds"))
        assertEquals(400, bad.statusCode.value())
        assertEquals("unknown station", advice.handleStation().body?.error)
        assertEquals(404, advice.handleNoHandler().statusCode.value())
        assertEquals("Invalid JSON", advice.handleBadJson().body?.error)
        assertEquals("internal error", advice.handleApi(ApiException(500, "boom")).body?.error)
        assertEquals("playlist not found", advice.handleApi(ApiException(404, "playlist not found")).body?.error)
        assertEquals(500, advice.handleOther(IllegalStateException("x")).statusCode.value())
    }
}
