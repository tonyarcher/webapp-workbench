package userapi.web

import kotlin.test.Test
import kotlin.test.assertEquals
import userapi.Settings

class ErrorAdviceBranchTest {
    private val advice = ErrorAdvice(Settings(3000, "", "error", "user-api", cookieSecure = false))

    @Test
    fun apiMapsStatus() {
        val res = advice.handleApi(ApiException(409, "conflict", "taken"))
        assertEquals(409, res.statusCode.value())
        assertEquals("conflict", res.body?.err?.type)
    }

    @Test
    fun tokenMapsBadRequest() {
        val res = advice.handleToken(OAuthTokenException("invalid_grant"))
        assertEquals(400, res.statusCode.value())
    }

    @Test
    fun noHandlerIs404() {
        val res = advice.handleNoHandler()
        assertEquals(404, res.statusCode.value())
    }

    @Test
    fun badJsonIs400() {
        val res = advice.handleBadJson()
        assertEquals(400, res.statusCode.value())
    }

    @Test
    fun methodIs405() {
        val res = advice.handleMethod()
        assertEquals(405, res.statusCode.value())
    }

    @Test
    fun mediaTypeIs415() {
        val res = advice.handleMediaType()
        assertEquals(415, res.statusCode.value())
    }

    @Test
    fun otherIs500() {
        val res = advice.handleOther(IllegalStateException("boom"))
        assertEquals(500, res.statusCode.value())
        assertEquals("IllegalStateException", res.body?.err?.type)
    }

    @Test
    fun otherFallbacks() {
        val anonymous = object : Exception() {}
        val res = advice.handleOther(anonymous)
        assertEquals(500, res.statusCode.value())
        val silent = advice.handleApi(ApiException(400, "t", ""))
        assertEquals(400, silent.statusCode.value())
    }
}
