package fitnessapi.web

import org.springframework.http.HttpStatus
import kotlin.test.Test
import kotlin.test.assertEquals

class ErrorAdviceBranchTest {
    private val advice = ErrorAdvice()

    @Test
    fun apiMapsClientError() {
        val res = advice.handleApi(ApiException(HttpStatus.BAD_REQUEST, "bad"))
        assertEquals(HttpStatus.BAD_REQUEST.value(), res.statusCode.value())
        assertEquals("bad", res.body?.error)
    }

    @Test
    fun apiMasksServerError() {
        val res = advice.handleApi(ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "secret detail"))
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR.value(), res.statusCode.value())
        assertEquals("internal error", res.body?.error)
    }

    @Test
    fun missingHandlers() {
        assertEquals(HttpStatus.NOT_FOUND.value(), advice.handleMissing().statusCode.value())
        assertEquals(HttpStatus.NOT_FOUND.value(), advice.handleNoHandler().statusCode.value())
        assertEquals(HttpStatus.BAD_REQUEST.value(), advice.handleBadJson().statusCode.value())
    }

    @Test
    fun otherIs500() {
        val res = advice.handleOther(IllegalStateException("boom"))
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR.value(), res.statusCode.value())
        assertEquals("internal error", res.body?.error)
    }

    @Test
    fun otherFallbacks() {
        val anonymous = object : Exception() {}
        val res = advice.handleOther(anonymous)
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR.value(), res.statusCode.value())
    }
}
