package stockgame.web

import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import stockgame.http.requestIdsFrom
import stockgame.log.log
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
            "stock-game-api",
            level,
            "request",
            mapOf(
                "method" to request.method,
                "path" to path,
                "status" to status,
                "duration_ms" to (System.nanoTime() - started) / 1_000_000,
                "request_id" to requestId,
            ),
        )
    }

    private fun levelFor(status: Int, health: Boolean): String =
        when {
            status >= 500 -> "error"
            health -> "debug"
            else -> "info"
        }
}
