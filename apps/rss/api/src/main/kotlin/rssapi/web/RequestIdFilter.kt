package rssapi.web
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import rssapi.domain.requestIdsFrom
import rssapi.log.log
import java.util.UUID

/** Nanosecond to millisecond conversion, and the status that means 'error'. */
private const val NS_PER_MS = 1_000_000
private const val HTTP_INTERNAL_ERROR = 500

@Component
class RequestIdFilter : OncePerRequestFilter() {
    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        val ids = requestIdsFrom(request.getHeader("X-Request-ID"), request.getHeader("traceparent"))
        response.setHeader("X-Request-ID", ids.requestId)
        val started = System.nanoTime()
        chain.doFilter(request, response)
        logRequest(request, response, ids.requestId, started)
    }

    private fun logRequest(
        request: HttpServletRequest,
        response: HttpServletResponse,
        requestId: String,
        started: Long,
    ) {
        val path = request.requestURI
        val status = response.status
        val health = path == "/healthz" || path == "/readyz"
        val level = levelFor(status, health)
        log(
            "rss-api",
            level,
            "request",
            mapOf(
                "method" to request.method,
                "path" to path,
                "status" to status,
                "duration_ms" to (System.nanoTime() - started) / NS_PER_MS,
                "request_id" to requestId,
            ),
        )
    }

    private fun levelFor(status: Int, health: Boolean): String = when {
        status >= HTTP_INTERNAL_ERROR -> "error"
        health -> "debug"
        else -> "info"
    }
}
