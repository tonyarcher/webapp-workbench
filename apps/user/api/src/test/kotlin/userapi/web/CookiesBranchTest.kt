package userapi.web

import jakarta.servlet.http.Cookie
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import userapi.Settings

class CookiesBranchTest {
    private val settings = Settings(3000, "", "error", "user-api", cookieSecure = false)

    private fun request(vararg cookies: Cookie?): HttpServletRequest {
        val req = mock<HttpServletRequest>()
        whenever(req.cookies).thenReturn(cookies.filterNotNull().toTypedArray().ifEmpty { null })
        return req
    }

    @Test
    fun cookieValues() {
        assertEquals("abc", request(Cookie("wb_session", "abc")).cookieValue("wb_session"))
        assertNull(request().cookieValue("wb_session"))
        assertNull(request(Cookie("wb_session", "   ")).cookieValue("wb_session"))
        assertNull(request(Cookie("other", "x")).cookieValue("wb_session"))
        assertEquals("p1", pendingToken(request(Cookie("wb_pending", "p1"))))
        assertNull(sessionToken(request()))
    }

    @Test
    fun csrfReuse() {
        val res = mock<HttpServletResponse>()
        val req = request(Cookie("wb_csrf", "keep-me"))
        assertEquals("keep-me", issueCsrf(req, res, settings))
        val fresh = issueCsrf(request(), mock(), settings)
        assertTrue(fresh.isNotEmpty())
    }

    @Test
    fun cookieBuilders() {
        val res = mock<HttpServletResponse>()
        appendSessionCookie(res, "t", settings)
        clearSessionCookie(res, settings)
        appendPendingCookie(res, "t", settings)
        clearPendingCookie(res, settings)
        val secure = settings.copy(cookieSecure = true)
        appendSessionCookie(mock(), "t", secure)
    }
}
