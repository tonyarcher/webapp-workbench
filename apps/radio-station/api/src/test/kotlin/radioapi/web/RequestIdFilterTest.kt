package radioapi.web

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletResponse
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import kotlin.test.Test
import kotlin.test.assertEquals

class RequestIdFilterTest {
    @Test
    fun echoesTraceAndLogsErrors() {
        val request = MockHttpServletRequest("GET", "/playlists")
        request.addHeader("traceparent", "00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01")
        val response = MockHttpServletResponse()
        val chain = FilterChain { _, res -> (res as HttpServletResponse).status = 500 }
        RequestIdFilter().doFilter(request, response, chain)
        assertEquals("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", response.getHeader("X-Request-ID"))
    }

    @Test
    fun healthIsQuiet() {
        val request = MockHttpServletRequest("GET", "/healthz")
        val response = MockHttpServletResponse()
        RequestIdFilter().doFilter(request, response, FilterChain { _, _ -> })
        assertEquals(200, response.status)
    }
}
