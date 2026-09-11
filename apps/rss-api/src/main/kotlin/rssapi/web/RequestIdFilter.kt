package rssapi.web

import java.util.UUID
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import rssapi.domain.requestIdsFrom
import rssapi.log.log
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse

@Component
class RequestIdFilter : OncePerRequestFilter() {
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        chain: FilterChain,
    ) {
        val ids = requestIdsFrom(request.getHeader("X-Request-ID"), request.getHeader("traceparent"))
        response.setHeader("X-Request-ID", ids.requestId)
        val started = System.nanoTime()
        chain.doFilter(request, response)
        val path = request.requestURI
        val status = response.status
        val health = path == "/healthz" || path == "/readyz"
        val level = when {
            status >= 500 -> "error"
            health -> "debug"
            else -> "info"
        }
        log(
            "rss-api",
            level,
            "request",
            mapOf(
                "method" to request.method,
                "path" to path,
                "status" to status,
                "duration_ms" to (System.nanoTime() - started) / 1_000_000,
                "request_id" to ids.requestId,
            ),
        )
    }
}
