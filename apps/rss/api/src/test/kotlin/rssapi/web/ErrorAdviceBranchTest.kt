package rssapi.web

import kotlin.test.Test
import kotlin.test.assertEquals

class ErrorAdviceBranchTest {
    private val advice = ErrorAdvice()

    @Test
    fun mapsErrors() {
        assertEquals(400, advice.handleApi(ApiException(400, "bad")).statusCode.value())
        assertEquals("bad", advice.handleApi(ApiException(400, "bad")).body?.error)
        assertEquals(500, advice.handleApi(ApiException(500, "x")).statusCode.value())
        assertEquals(404, advice.handleMissing().statusCode.value())
        assertEquals(404, advice.handleNoHandler().statusCode.value())
        assertEquals(400, advice.handleBadJson().statusCode.value())
        assertEquals(500, advice.handleOther().statusCode.value())
    }
}
