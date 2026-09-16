package userapi.web

import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.web.filter.OncePerRequestFilter
import userapi.domain.tokenEquals

class CsrfFilter(private val mapper: ObjectMapper) : OncePerRequestFilter() {
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        chain: FilterChain,
    ) {
        if (needsCsrf(request) && !csrfOk(request)) {
            rejectCsrf(response)
            return
        }
        chain.doFilter(request, response)
    }

    private fun needsCsrf(request: HttpServletRequest): Boolean =
        request.method == "POST" && request.requestURI != "/oauth/token"

    private fun csrfOk(request: HttpServletRequest): Boolean {
        val cookie = request.cookieValue(CSRF_COOKIE).orEmpty()
        val header = request.getHeader(CSRF_HEADER).orEmpty()
        return cookie.isNotBlank() && header.isNotBlank() && tokenEquals(cookie, header)
    }

    private fun rejectCsrf(response: HttpServletResponse) {
        response.status = HttpStatus.FORBIDDEN.value()
        response.contentType = MediaType.APPLICATION_JSON_VALUE
        response.writer.write(mapper.writeValueAsString(ErrBody(ErrDetail("csrf", "csrf token mismatch"))))
    }
}
