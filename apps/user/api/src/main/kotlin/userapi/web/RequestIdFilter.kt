package userapi.web

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import userapi.http.RequestIds
import userapi.http.requestIdsFrom
import userapi.log.log

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
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
        logRequest(request, response, ids, started)
    }

    private fun logRequest(
        request: HttpServletRequest,
        response: HttpServletResponse,
        ids: RequestIds,
        started: Long,
    ) {
        val path = request.requestURI
        val status = response.status
        val health = path == "/healthz" || path == "/readyz"
        val level = levelFor(status, health)
        log(
            "user-api",
            level,
            "request",
            requestExtra(request, status, started, ids),
        )
    }

    private fun requestExtra(
        request: HttpServletRequest,
        status: Int,
        started: Long,
        ids: RequestIds,
    ): Map<String, Any?> {
        val extra = mutableMapOf<String, Any?>(
            "method" to request.method,
            "path" to request.requestURI,
            "status" to status,
            "duration_ms" to (System.nanoTime() - started) / 1_000_000,
            "request_id" to ids.requestId,
        )
        if (ids.traceId != null) extra["trace_id"] = ids.traceId
        if (ids.spanId != null) extra["span_id"] = ids.spanId
        return extra
    }

    private fun levelFor(status: Int, health: Boolean): String =
        when {
            status >= 500 -> "error"
            health -> "debug"
            else -> "info"
        }
}
