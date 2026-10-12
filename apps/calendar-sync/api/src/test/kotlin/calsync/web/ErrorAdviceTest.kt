package calsync.web

import org.junit.jupiter.api.Test
import org.springframework.http.HttpStatus
import kotlin.test.assertEquals

class ErrorAdviceTest {
    private val advice = ErrorAdvice()

    @Test
    fun apiExceptionMapsStatusAndMessage() {
        val res = advice.handleApi(ApiException(HttpStatus.BAD_REQUEST, "nope"))
        assertEquals(HttpStatus.BAD_REQUEST, res.statusCode)
        assertEquals(ErrorBody("nope"), res.body)
    }

    @Test
    fun missingMaps404() {
        val res = advice.handleMissing()
        assertEquals(HttpStatus.NOT_FOUND, res.statusCode)
    }

    @Test
    fun badJsonMaps400() {
        val res = advice.handleBadJson()
        assertEquals(HttpStatus.BAD_REQUEST, res.statusCode)
    }

    @Test
    fun otherMaps500() {
        val res = advice.handleOther()
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, res.statusCode)
        assertEquals(ErrorBody("internal error"), res.body)
    }
}
