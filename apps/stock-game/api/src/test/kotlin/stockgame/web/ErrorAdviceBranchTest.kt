package stockgame.web

import kotlin.test.Test
import kotlin.test.assertEquals
import stockgame.domain.ProviderError
import stockgame.domain.TradingError

class ErrorAdviceBranchTest {
    private val advice = ErrorAdvice()

    @Test
    fun mapsKnownErrors() {
        assertEquals(400, advice.handleApi(ApiException(400, "bad")).statusCode.value())
        assertEquals(400, advice.handleTrade(TradingError("nope")).statusCode.value())
        assertEquals(502, advice.handleProvider(ProviderError("down")).statusCode.value())
    }

    @Test
    fun mapsFrameworkErrors() {
        assertEquals(404, advice.handleNoHandler().statusCode.value())
        assertEquals(400, advice.handleBadJson().statusCode.value())
        assertEquals(400, advice.handleBadParam().statusCode.value())
    }

    @Test
    fun otherIs500() {
        val res = advice.handleOther(IllegalStateException("boom"))
        assertEquals(500, res.statusCode.value())
        assertEquals("internal error", res.body?.error)
    }

    @Test
    fun otherFallbacks() {
        val anonymous = object : Exception() {}
        assertEquals(500, advice.handleOther(anonymous).statusCode.value())
    }
}
