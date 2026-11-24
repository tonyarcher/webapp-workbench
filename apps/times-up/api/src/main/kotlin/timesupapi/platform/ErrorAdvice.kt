package timesupapi.platform
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.HttpStatusCode
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.servlet.NoHandlerFoundException
import timesupapi.platform.log.log

data class ErrorBody(val error: String)

private const val HTTP_PAYLOAD_TOO_LARGE = 413

class ApiException(val status: HttpStatusCode, message: String, cause: Throwable? = null) :
    RuntimeException(message, cause)

@RestControllerAdvice
class ErrorAdvice {
    @ExceptionHandler(ApiException::class)
    fun handleApi(ex: ApiException): ResponseEntity<ErrorBody> =
        ResponseEntity.status(ex.status).body(ErrorBody(ex.message ?: "error"))

    @ExceptionHandler(NoSuchElementException::class)
    fun handleMissing(): ResponseEntity<ErrorBody> =
        ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorBody("not found"))

    @ExceptionHandler(NoHandlerFoundException::class)
    fun handleNoHandler(): ResponseEntity<ErrorBody> =
        ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorBody("not found"))

    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun handleBadJson(ex: HttpMessageNotReadableException): ResponseEntity<ErrorBody> =
        if (containsBodyLimit(ex)) handleTooLarge() else badJson()

    @ExceptionHandler(RequestBodyTooLargeException::class)
    fun handleTooLarge(): ResponseEntity<ErrorBody> = tooLargeResponse()

    @ExceptionHandler(Exception::class)
    fun handleOther(ex: Exception, request: HttpServletRequest): ResponseEntity<ErrorBody> {
        log("times-up-api", "error", "unhandled request", unhandledErrorFields(request, ex))
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ErrorBody("internal error"))
    }
}

private fun badJson(): ResponseEntity<ErrorBody> =
    ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorBody("Invalid JSON"))

private fun tooLargeResponse(): ResponseEntity<ErrorBody> =
    ResponseEntity.status(HttpStatusCode.valueOf(HTTP_PAYLOAD_TOO_LARGE)).body(ErrorBody("request body too large"))

private fun containsBodyLimit(ex: Throwable): Boolean =
    generateSequence(ex) { it.cause }.any { it is RequestBodyTooLargeException }

internal fun unhandledErrorFields(request: HttpServletRequest, ex: Throwable): Map<String, Any?> {
    val ids = currentRequestIds(request)
    return buildMap {
        put("request_id", ids.requestId)
        put("trace_id", ids.traceId)
        put("span_id", ids.spanId)
        put("method", request.method)
        put("path", request.requestURI)
        put(
            "err",
            mapOf(
                "type" to (ex::class.simpleName ?: "Error"),
                "message" to (ex.message ?: ""),
            ),
        )
    }
}
