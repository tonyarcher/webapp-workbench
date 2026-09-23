package stockgame.web

import org.springframework.http.HttpStatus
import stockgame.domain.ProviderError
import stockgame.domain.TradingError
import kotlin.test.Test
import kotlin.test.assertEquals

class ErrorAdviceBranchTest {
    private val advice = ErrorAdvice()

    @Test
    fun mapsKnownErrors() {
        assertEquals(
            HttpStatus.BAD_REQUEST,
            advice.handleApi(ApiException(HttpStatus.BAD_REQUEST, "bad")).statusCode,
        )
        assertEquals(HttpStatus.BAD_REQUEST.value(), advice.handleTrade(TradingError("nope")).statusCode.value())
        assertEquals(HttpStatus.BAD_GATEWAY.value(), advice.handleProvider(ProviderError("down")).statusCode.value())
    }

    @Test
    fun mapsFrameworkErrors() {
        assertEquals(HttpStatus.NOT_FOUND.value(), advice.handleNoHandler().statusCode.value())
        assertEquals(HttpStatus.BAD_REQUEST.value(), advice.handleBadJson().statusCode.value())
        assertEquals(HttpStatus.BAD_REQUEST.value(), advice.handleBadParam().statusCode.value())
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
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR.value(), advice.handleOther(anonymous).statusCode.value())
    }
}
