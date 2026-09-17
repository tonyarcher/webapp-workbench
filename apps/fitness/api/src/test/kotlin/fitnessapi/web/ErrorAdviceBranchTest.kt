package fitnessapi.web

import kotlin.test.Test
import kotlin.test.assertEquals

class ErrorAdviceBranchTest {
    private val advice = ErrorAdvice()

    @Test
    fun apiMapsClientError() {
        val res = advice.handleApi(ApiException(400, "bad"))
        assertEquals(400, res.statusCode.value())
        assertEquals("bad", res.body?.error)
    }

    @Test
    fun apiMasksServerError() {
        val res = advice.handleApi(ApiException(500, "secret detail"))
        assertEquals(500, res.statusCode.value())
        assertEquals("internal error", res.body?.error)
    }

    @Test
    fun missingHandlers() {
        assertEquals(404, advice.handleMissing().statusCode.value())
        assertEquals(404, advice.handleNoHandler().statusCode.value())
        assertEquals(400, advice.handleBadJson().statusCode.value())
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
        val res = advice.handleOther(anonymous)
        assertEquals(500, res.statusCode.value())
    }
}
