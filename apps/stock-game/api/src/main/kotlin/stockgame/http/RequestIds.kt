package stockgame.http

import java.util.UUID

data class RequestIds(
    val requestId: String,
    val traceId: String? = null,
    val spanId: String? = null,
)

private val TRACEPARENT =
    Regex("^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$", RegexOption.IGNORE_CASE)

fun requestIdsFrom(
    requestIdHeader: String?,
    traceparent: String?,
    newId: () -> String = { UUID.randomUUID().toString() },
): RequestIds {
    val traced = parseTraceparent(traceparent)
    val incoming = requestIdHeader?.takeIf { it.isNotBlank() && it.length <= 128 }
    val requestId = incoming ?: traced?.traceId ?: newId()
    return if (traced == null) {
        RequestIds(requestId)
    } else {
        RequestIds(requestId, traced.traceId, traced.spanId)
    }
}

fun parseTraceparent(header: String?): RequestIds? {
    if (header.isNullOrBlank()) return null
    val match = TRACEPARENT.matchEntire(header.trim()) ?: return null
    val traceId = match.groupValues[1].lowercase()
    val spanId = match.groupValues[2].lowercase()
    return RequestIds(requestId = traceId, traceId = traceId, spanId = spanId)
}
