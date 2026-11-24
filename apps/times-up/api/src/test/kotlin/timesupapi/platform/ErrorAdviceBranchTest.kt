package timesupapi.platform

import org.springframework.http.HttpStatus
import org.springframework.mock.http.MockHttpInputMessage
import org.springframework.mock.web.MockHttpServletRequest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ErrorAdviceBranchTest {
    private val advice = ErrorAdvice()

    @Test
    fun mapsApiAndMissingErrors() {
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
    }

    @Test
    fun mapsBadJsonAndBodyLimit() {
        assertEquals(
            HttpStatus.BAD_REQUEST.value(),
            advice.handleBadJson(
                org.springframework.http.converter.HttpMessageNotReadableException(
                    "bad",
                    MockHttpInputMessage(ByteArray(0)),
                ),
            ).statusCode.value(),
        )
        assertEquals(
            org.springframework.http.HttpStatusCode.valueOf(413).value(),
            advice.handleBadJson(
                org.springframework.http.converter.HttpMessageNotReadableException(
                    "bad",
                    RequestBodyTooLargeException(),
                    MockHttpInputMessage(ByteArray(0)),
                ),
            ).statusCode.value(),
        )
        assertEquals(
            org.springframework.http.HttpStatusCode.valueOf(413).value(),
            advice.handleTooLarge().statusCode.value(),
        )
    }

    @Test
    fun unhandledErrorStatus() {
        val request = MockHttpServletRequest("GET", "/boom")
        storeRequestIds(request, RequestIds("req", "trace", "span"))
        assertEquals(
            HttpStatus.INTERNAL_SERVER_ERROR.value(),
            advice.handleOther(IllegalStateException("bad"), request).statusCode.value(),
        )
    }

    @Test
    fun unhandledErrorFieldsUseFallbacks() {
        val request = MockHttpServletRequest("GET", "/boom")
        val fields = unhandledErrorFields(request, object : RuntimeException() {})
        assertEquals("Error", fields["err"].let { (it as Map<*, *>)["type"] })
        assertEquals("", (fields["err"] as Map<*, *>)["message"])
    }

    @Test
    fun unhandledErrorFieldsCarryTraceAndError() {
        val request = MockHttpServletRequest("GET", "/boom")
        storeRequestIds(request, RequestIds("req", "trace", "span"))
        val fields = unhandledErrorFields(request, IllegalStateException("bad"))
        assertEquals("req", fields["request_id"])
        assertEquals("trace", fields["trace_id"])
        assertEquals("span", fields["span_id"])
        assertEquals("GET", fields["method"])
        assertEquals("/boom", fields["path"])
        assertTrue((fields["err"] as Map<*, *>)["message"] == "bad")
    }
}
