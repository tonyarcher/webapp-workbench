package fitnessapi.web

import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.servlet.NoHandlerFoundException
import fitnessapi.log.log

data class ErrorBody(val error: String)

class ApiException(val status: Int, message: String, cause: Throwable? = null) : RuntimeException(message, cause)

@RestControllerAdvice
class ErrorAdvice {
    @ExceptionHandler(ApiException::class)
    fun handleApi(ex: ApiException): ResponseEntity<ErrorBody> {
        if (ex.status >= 500) logUnhandled(ex)
        val message = if (ex.status >= 500) "internal error" else ex.message ?: "error"
        return ResponseEntity.status(ex.status).body(ErrorBody(message))
    }

    @ExceptionHandler(NoSuchElementException::class)
    fun handleMissing(): ResponseEntity<ErrorBody> =
        ResponseEntity.status(404).body(ErrorBody("not found"))

    @ExceptionHandler(NoHandlerFoundException::class)
    fun handleNoHandler(): ResponseEntity<ErrorBody> =
        ResponseEntity.status(404).body(ErrorBody("not found"))

    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun handleBadJson(): ResponseEntity<ErrorBody> =
        ResponseEntity.status(400).body(ErrorBody("Invalid JSON"))

    @ExceptionHandler(Exception::class)
    fun handleOther(ex: Exception): ResponseEntity<ErrorBody> {
        logUnhandled(ex)
        return ResponseEntity.status(500).body(ErrorBody("internal error"))
    }
}

internal fun logUnhandled(cause: Throwable) {
    log(
        "fitness-api",
        "error",
        "unhandled",
        mapOf(
            "err" to mapOf(
                "type" to (cause::class.simpleName ?: "Error"),
                "message" to (cause.message ?: ""),
            ),
        ),
    )
}
