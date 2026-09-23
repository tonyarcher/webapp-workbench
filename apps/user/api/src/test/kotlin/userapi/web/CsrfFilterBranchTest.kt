package userapi.web

import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.FilterChain
import jakarta.servlet.http.Cookie
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.io.PrintWriter
import java.io.StringWriter
import kotlin.test.Test
import kotlin.test.assertTrue

class CsrfFilterBranchTest {
    private val filter = CsrfFilter(ObjectMapper())

    private fun request(method: String, uri: String, cookie: String?, header: String?): HttpServletRequest {
        val req = mock<HttpServletRequest>()
        whenever(req.method).thenReturn(method)
        whenever(req.requestURI).thenReturn(uri)
        whenever(req.cookies).thenReturn(cookie?.let { arrayOf(Cookie(CSRF_COOKIE, it)) })
        whenever(req.getHeader(CSRF_HEADER)).thenReturn(header)
        return req
    }

    private fun response(): Pair<HttpServletResponse, StringWriter> {
        val res = mock<HttpServletResponse>()
        val out = StringWriter()
        whenever(res.writer).thenReturn(PrintWriter(out))
        return res to out
    }

    @Test
    fun getPassesThrough() {
        val chain = mock<FilterChain>()
        filter.doFilter(request("GET", "/me", null, null), mock<HttpServletResponse>(), chain)
        verify(chain).doFilter(org.mockito.kotlin.any(), org.mockito.kotlin.any())
    }

    @Test
    fun oauthTokenSkips() {
        val chain = mock<FilterChain>()
        filter.doFilter(request("POST", "/oauth/token", null, null), mock<HttpServletResponse>(), chain)
        verify(chain).doFilter(org.mockito.kotlin.any(), org.mockito.kotlin.any())
    }

    @Test
    fun mismatchedTokensRejected() {
        val chain = mock<FilterChain>()
        val (res, out) = response()
        filter.doFilter(request("POST", "/me", "abc", "xyz"), res, chain)
        verify(chain, never()).doFilter(org.mockito.kotlin.any(), org.mockito.kotlin.any())
        verify(res).status = 403
        assertTrue(out.toString().contains("csrf"))
    }

    @Test
    fun blankHalvesRejected() {
        val chain = mock<FilterChain>()
        val (res, _) = response()
        filter.doFilter(request("POST", "/me", "abc", null), res, chain)
        filter.doFilter(request("POST", "/me", null, "abc"), res, chain)
        verify(chain, never()).doFilter(org.mockito.kotlin.any(), org.mockito.kotlin.any())
    }

    @Test
    fun matchingTokensPass() {
        val chain = mock<FilterChain>()
        val res = mock<HttpServletResponse>()
        filter.doFilter(request("POST", "/me", "tok123", "tok123"), res, chain)
        verify(chain).doFilter(org.mockito.kotlin.any(), org.mockito.kotlin.any())
    }
}
