package timesupapi.platform

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class JsonBodyLimitFilterTest {
    private val filter = JsonBodyLimitFilter(maxBytes = 4)

    private fun request(body: String, length: Int = body.toByteArray().size): MockHttpServletRequest =
        MockHttpServletRequest("POST", "/articles/state").apply {
            contentType = "application/json"
            this.setContent(body.toByteArray())
            addHeader("Content-Length", length.toString())
        }

    @Test
    fun rejectsKnownOversizedBodyBeforeTheChain() {
        val response = MockHttpServletResponse()
        var called = false
        val chain = FilterChain { _, _ -> called = true }
        filter.doFilter(request("12345"), response, chain)
        assertFalse(called)
        assertEquals(413, response.status)
        assertEquals("""{"error":"request body too large"}""", response.contentAsString)
    }

    @Test
    fun rejectsOversizedChunkedBodyWhileReading() {
        val source = MockHttpServletRequest().apply { setContent("12345".toByteArray()) }
        val req = mock<HttpServletRequest>()
        whenever(req.method).thenReturn("POST")
        whenever(req.contentType).thenReturn("application/json")
        whenever(req.contentLengthLong).thenReturn(-1L)
        whenever(req.inputStream).thenReturn(source.inputStream)
        val response = MockHttpServletResponse()
        var called = false
        val chain = FilterChain { wrapped, _ ->
            called = true
            wrapped.inputStream.readBytes()
        }
        filter.doFilter(req, response, chain)
        assertTrue(called)
        assertEquals(413, response.status)
    }

    @Test
    fun acceptsBodyExactlyAtTheLimit() {
        val response = MockHttpServletResponse()
        val chain = FilterChain { req, res ->
            assertEquals("1234", req.inputStream.readBytes().toString(Charsets.UTF_8))
            (res as HttpServletResponse).status = 200
        }
        filter.doFilter(request("1234", length = -1), response, chain)
        assertEquals(200, response.status)
    }

    @Test
    fun readerUsesConfiguredEncodingOrDefault() {
        val withSource: (String?) -> HttpServletRequest = { encoding ->
            mock<HttpServletRequest>().also {
                whenever(it.characterEncoding).thenReturn(encoding)
                whenever(it.inputStream).thenReturn(
                    MockHttpServletRequest().apply { setContent("é".toByteArray(Charsets.UTF_8)) }.inputStream,
                )
            }
        }
        assertEquals("é", BoundedRequestWrapper(withSource(null), 10).reader.readText())
        assertEquals("é", BoundedRequestWrapper(withSource("UTF-8"), 10).reader.readText())
    }

    @Test
    fun ignoresNonJsonRequests() {
        val req = request("12345")
        req.contentType = "text/plain"
        val response = MockHttpServletResponse()
        var called = false
        val chain = FilterChain { _, _ -> called = true }
        filter.doFilter(req, response, chain)
        assertTrue(called)
        assertEquals(200, response.status)
    }
}
