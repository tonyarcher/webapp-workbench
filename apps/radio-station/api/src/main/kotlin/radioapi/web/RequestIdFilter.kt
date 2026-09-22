package radioapi.web

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import radioapi.http.requestIdsFrom
import radioapi.log.log

@Component
class RequestIdFilter : OncePerRequestFilter() {
    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        val ids = requestIdsFrom(request.getHeader("X-Request-ID"), request.getHeader("traceparent"))
        response.setHeader("X-Request-ID", ids.requestId)
        val started = System.nanoTime()
        chain.doFilter(request, response)
        logRequest(request, response, ids.requestId, started, ids.traceId, ids.spanId)
    }
}

private fun logRequest(
    request: HttpServletRequest,
    response: HttpServletResponse,
    requestId: String,
    started: Long,
    traceId: String?,
    spanId: String?,
) {
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
        "request_id" to requestId,
    )
    if (traceId != null) extra["trace_id"] = traceId
    if (spanId != null) extra["span_id"] = spanId
    log("radio-api", level, "request", extra)
}
