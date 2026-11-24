package timesupapi.platform

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

internal const val MAX_JSON_BYTES: Int = MAX_BODY_BYTES

private const val HTTP_PAYLOAD_TOO_LARGE = 413
private const val APPLICATION_JSON = "application/json"

/** Rejects oversized JSON before parsing, including chunked bodies without Content-Length. */
@Component
class JsonBodyLimitFilter(private val maxBytes: Int = MAX_JSON_BYTES) : OncePerRequestFilter() {
    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        if (!isJsonWrite(request)) {
            chain.doFilter(request, response)
            return
        }
        val length = request.contentLengthLong
        if (length > maxBytes) {
            reject(response)
            return
        }
        if (length >= 0) {
            chain.doFilter(request, response)
            return
        }
        try {
            chain.doFilter(BoundedRequestWrapper(request, maxBytes.toLong()), response)
        } catch (_: RequestBodyTooLargeException) {
            reject(response)
        }
    }

    private fun isJsonWrite(request: HttpServletRequest): Boolean = request.method in setOf("POST", "PUT", "PATCH") &&
        request.contentType?.substringBefore(';')?.trim()?.equals(APPLICATION_JSON, ignoreCase = true) == true

    private fun reject(response: HttpServletResponse) {
        response.status = HTTP_PAYLOAD_TOO_LARGE
        response.contentType = APPLICATION_JSON
        response.writer.write("""{"error":"request body too large"}""")
    }
}
