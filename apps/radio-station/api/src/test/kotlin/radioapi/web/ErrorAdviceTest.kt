package radioapi.web

import org.springframework.http.HttpStatus
import radioapi.domain.BadInput
import radioapi.service.UnknownStation
import kotlin.test.Test
import kotlin.test.assertEquals

class ErrorAdviceTest {
    private val advice = ErrorAdvice()

    @Test
    fun mapsKnownFailures() {
        val bad = advice.handleBad(BadInput("startsAt must be epoch milliseconds"))
        assertEquals(HttpStatus.BAD_REQUEST.value(), bad.statusCode.value())
        assertEquals("unknown station", advice.handleStation().body?.error)
        assertEquals(HttpStatus.NOT_FOUND.value(), advice.handleNoHandler().statusCode.value())
        assertEquals("Invalid JSON", advice.handleBadJson().body?.error)
        assertEquals(
            "internal error",
            advice.handleApi(ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "boom")).body?.error,
        )
        assertEquals(
            "playlist not found",
            advice.handleApi(ApiException(HttpStatus.NOT_FOUND, "playlist not found")).body?.error,
        )
        assertEquals(
            HttpStatus.INTERNAL_SERVER_ERROR.value(),
            advice.handleOther(IllegalStateException("x")).statusCode.value(),
        )
    }
}
