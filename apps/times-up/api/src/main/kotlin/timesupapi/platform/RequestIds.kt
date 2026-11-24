package timesupapi.platform
import jakarta.servlet.http.HttpServletRequest
import java.util.UUID

const val REQUEST_ID_ATTRIBUTE = "timesup.requestId"
const val TRACE_ID_ATTRIBUTE = "timesup.traceId"
const val SPAN_ID_ATTRIBUTE = "timesup.spanId"

data class RequestIds(val requestId: String, val traceId: String? = null, val spanId: String? = null)

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
    return if (traced == null) RequestIds(requestId) else RequestIds(requestId, traced.traceId, traced.spanId)
}

fun parseTraceparent(header: String?): RequestIds? {
    if (header.isNullOrBlank()) return null
    val match = TRACEPARENT.matchEntire(header.trim()) ?: return null
    return RequestIds(
        requestId = match.groupValues[1].lowercase(),
        traceId = match.groupValues[1].lowercase(),
        spanId = match.groupValues[2].lowercase(),
    )
}

fun storeRequestIds(request: HttpServletRequest, ids: RequestIds) {
    request.setAttribute(REQUEST_ID_ATTRIBUTE, ids.requestId)
    ids.traceId?.let { request.setAttribute(TRACE_ID_ATTRIBUTE, it) }
    ids.spanId?.let { request.setAttribute(SPAN_ID_ATTRIBUTE, it) }
}

fun currentRequestIds(request: HttpServletRequest): RequestIds {
    val stored = request.getAttribute(REQUEST_ID_ATTRIBUTE) as? String
    if (stored != null) {
        return RequestIds(
            requestId = stored,
            traceId = request.getAttribute(TRACE_ID_ATTRIBUTE) as? String,
            spanId = request.getAttribute(SPAN_ID_ATTRIBUTE) as? String,
        )
    }
    return requestIdsFrom(request.getHeader("X-Request-ID"), request.getHeader("traceparent"))
}
