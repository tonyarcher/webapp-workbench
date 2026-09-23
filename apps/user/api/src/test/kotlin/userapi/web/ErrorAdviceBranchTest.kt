package userapi.web

import org.springframework.http.HttpStatus
import userapi.Settings
import kotlin.test.Test
import kotlin.test.assertEquals

class ErrorAdviceBranchTest {
    private val advice = ErrorAdvice(Settings(3000, "", "error", "user-api", cookieSecure = false))

    @Test
    fun apiMapsStatus() {
        val res = advice.handleApi(ApiException(HttpStatus.CONFLICT, "conflict", "taken"))
        assertEquals(HttpStatus.CONFLICT.value(), res.statusCode.value())
        assertEquals("conflict", res.body?.err?.type)
    }

    @Test
    fun tokenMapsBadRequest() {
        val res = advice.handleToken(OAuthTokenException("invalid_grant"))
        assertEquals(HttpStatus.BAD_REQUEST.value(), res.statusCode.value())
    }

    @Test
    fun noHandlerIs404() {
        val res = advice.handleNoHandler()
        assertEquals(HttpStatus.NOT_FOUND.value(), res.statusCode.value())
    }

    @Test
    fun badJsonIs400() {
        val res = advice.handleBadJson()
        assertEquals(HttpStatus.BAD_REQUEST.value(), res.statusCode.value())
    }

    @Test
    fun methodIs405() {
        val res = advice.handleMethod()
        assertEquals(HttpStatus.METHOD_NOT_ALLOWED.value(), res.statusCode.value())
    }

    @Test
    fun mediaTypeIs415() {
        val res = advice.handleMediaType()
        assertEquals(HttpStatus.UNSUPPORTED_MEDIA_TYPE.value(), res.statusCode.value())
    }

    @Test
    fun otherIs500() {
        val res = advice.handleOther(IllegalStateException("boom"))
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR.value(), res.statusCode.value())
        assertEquals("IllegalStateException", res.body?.err?.type)
    }

    @Test
    fun otherFallbacks() {
        val anonymous = object : Exception() {}
        val res = advice.handleOther(anonymous)
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR.value(), res.statusCode.value())
        val silent = advice.handleApi(ApiException(HttpStatus.BAD_REQUEST, "t", ""))
        assertEquals(HttpStatus.BAD_REQUEST.value(), silent.statusCode.value())
    }
}
