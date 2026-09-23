package rssapi.web

import org.springframework.http.HttpStatus
import kotlin.test.Test
import kotlin.test.assertEquals

class ErrorAdviceBranchTest {
    private val advice = ErrorAdvice()

    @Test
    fun mapsErrors() {
        assertEquals(
            HttpStatus.BAD_REQUEST.value(),
            advice.handleApi(ApiException(HttpStatus.BAD_REQUEST, "bad")).statusCode.value(),
        )
        assertEquals("bad", advice.handleApi(ApiException(HttpStatus.BAD_REQUEST, "bad")).body?.error)
        assertEquals(
            HttpStatus.INTERNAL_SERVER_ERROR.value(),
            advice.handleApi(ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "x")).statusCode.value(),
        )
        assertEquals(HttpStatus.NOT_FOUND.value(), advice.handleMissing().statusCode.value())
        assertEquals(HttpStatus.NOT_FOUND.value(), advice.handleNoHandler().statusCode.value())
        assertEquals(HttpStatus.BAD_REQUEST.value(), advice.handleBadJson().statusCode.value())
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR.value(), advice.handleOther().statusCode.value())
    }
}
