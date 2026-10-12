package calsync.web

import jakarta.servlet.FilterChain
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import java.util.UUID
import kotlin.test.assertEquals

class RequestIdFilterTest {
    private val filter = RequestIdFilter()
    private val chain: FilterChain = mock()

    private fun run(request: MockHttpServletRequest): MockHttpServletResponse {
        val response = MockHttpServletResponse()
        filter.doFilter(request, response, chain)
        verify(chain).doFilter(request, response)
        return response
    }

    @Test
    fun incomingRequestIdEchoes() {
        val request = MockHttpServletRequest("GET", "/healthz")
        request.addHeader("X-Request-ID", "req-1")
        assertEquals("req-1", run(request).getHeader("X-Request-ID"))
    }

    @Test
    fun missingRequestIdGeneratesUuid() {
        val request = MockHttpServletRequest("GET", "/trakt/credentials")
        val generated = run(request).getHeader("X-Request-ID")!!
        UUID.fromString(generated)
    }

    @Test
    fun traceparentSuppliesRequestId() {
        val trace = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
        val request = MockHttpServletRequest("GET", "/healthz")
        request.addHeader("traceparent", trace)
        assertEquals("4bf92f3577b34da6a3ce929d0e0e4736", run(request).getHeader("X-Request-ID"))
    }

    @Test
    fun overlongRequestIdIgnored() {
        val request = MockHttpServletRequest("GET", "/healthz")
        request.addHeader("X-Request-ID", "x".repeat(129))
        val generated = run(request).getHeader("X-Request-ID")!!
        UUID.fromString(generated)
    }

    @Test
    fun serverErrorStillEchoesId() {
        val request = MockHttpServletRequest("GET", "/healthz")
        request.addHeader("X-Request-ID", "req-9")
        val response = MockHttpServletResponse()
        response.status = 500
        filter.doFilter(request, response, chain)
        verify(chain).doFilter(request, response)
        assertEquals("req-9", response.getHeader("X-Request-ID"))
    }
}
