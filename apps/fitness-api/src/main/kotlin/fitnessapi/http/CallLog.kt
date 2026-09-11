package fitnessapi.http

import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCallPipeline
import io.ktor.server.application.call
import io.ktor.server.request.httpMethod
import io.ktor.server.request.path
import io.ktor.server.response.header
import fitnessapi.Settings
import fitnessapi.log.log

fun Application.installCallLog(settings: Settings) {
    intercept(ApplicationCallPipeline.Monitoring) {
        val ids = requestIdsFrom(
            call.request.headers["X-Request-ID"],
            call.request.headers["traceparent"],
        )
        call.response.header("X-Request-ID", ids.requestId)
        val started = System.nanoTime()
        try {
            proceed()
        } finally {
            writeRequestLog(
                settings,
                call.request.httpMethod.value,
                call.request.path(),
                call.response.status()?.value ?: 0,
                started,
                ids,
            )
        }
    }
}

internal fun writeRequestLog(
    settings: Settings,
    method: String,
    path: String,
    status: Int,
    startedNanos: Long,
    ids: RequestIds,
) {
    val health = path == "/healthz" || path == "/readyz"
    val level = when {
        status >= 500 -> "error"
        health -> "debug"
        else -> "info"
    }
    log(
        service = settings.service,
        level = level,
        msg = "request",
        extra = requestLogExtra(method, path, status, startedNanos, ids),
        minLevel = settings.logLevel,
    )
}

internal fun requestLogExtra(
    method: String,
    path: String,
    status: Int,
    startedNanos: Long,
    ids: RequestIds,
): Map<String, Any?> {
    val extra = mutableMapOf<String, Any?>(
        "method" to method,
        "path" to path,
        "status" to status,
        "duration_ms" to (System.nanoTime() - startedNanos) / 1_000_000,
        "request_id" to ids.requestId,
    )
    if (ids.traceId != null) extra["trace_id"] = ids.traceId
    if (ids.spanId != null) extra["span_id"] = ids.spanId
    return extra
}
