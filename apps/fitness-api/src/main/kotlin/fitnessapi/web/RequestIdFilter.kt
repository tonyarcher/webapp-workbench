package fitnessapi.web

import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import fitnessapi.http.requestIdsFrom
import fitnessapi.log.log
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
        val extra = mutableMapOf<String, Any?>(
            "method" to request.method,
            "path" to path,
            "status" to status,
            "duration_ms" to (System.nanoTime() - started) / 1_000_000,
            "request_id" to ids.requestId,
        )
        if (ids.traceId != null) extra["trace_id"] = ids.traceId
        if (ids.spanId != null) extra["span_id"] = ids.spanId
        log("fitness-api", level, "request", extra)
    }
}
