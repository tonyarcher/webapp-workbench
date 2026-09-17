package fitnessapi.web

import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse

private const val MAX_BODY_BYTES = 2_000_000L

/**
 * Caps JSON bodies when Content-Length is present. Chunked requests skip the check.
 * Writes the response here because ControllerAdvice does not catch filter throws.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class BodySizeFilter : OncePerRequestFilter() {
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        chain: FilterChain,
    ) {
        val length = request.contentLengthLong
        if (length > MAX_BODY_BYTES) {
            response.status = 400
            response.contentType = MediaType.APPLICATION_JSON_VALUE
            response.writer.write("""{"error":"Request body too large"}""")
            return
        }
        chain.doFilter(request, response)
    }
}
