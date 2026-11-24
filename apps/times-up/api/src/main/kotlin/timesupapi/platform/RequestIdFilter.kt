package timesupapi.platform
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import timesupapi.platform.log.log

/** Nanosecond to millisecond conversion, and the status that means 'error'. */
private const val NS_PER_MS = 1_000_000
private const val HTTP_INTERNAL_ERROR = 500

@Component
class RequestIdFilter : OncePerRequestFilter() {
    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        val ids = requestIdsFrom(request.getHeader("X-Request-ID"), request.getHeader("traceparent"))
        storeRequestIds(request, ids)
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
        log("times-up-api", level, "request", requestLogFields(request, response, ids, started))
    }

    private fun levelFor(status: Int, health: Boolean): String = when {
        status >= HTTP_INTERNAL_ERROR -> "error"
        health -> "debug"
        else -> "info"
    }
}

internal fun requestLogFields(
    request: HttpServletRequest,
    response: HttpServletResponse,
    ids: RequestIds,
    started: Long,
): Map<String, Any?> = buildMap {
    put("method", request.method)
    put("path", request.requestURI)
    put("status", response.status)
    put("duration_ms", (System.nanoTime() - started) / NS_PER_MS)
    put("request_id", ids.requestId)
    ids.traceId?.let { put("trace_id", it) }
    ids.spanId?.let { put("span_id", it) }
}
