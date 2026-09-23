package radioapi.web

import org.springframework.http.HttpStatus
import org.springframework.http.HttpStatusCode
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.servlet.NoHandlerFoundException
import radioapi.domain.BadInput
import radioapi.log.log
import radioapi.service.UnknownStation

data class ErrorBody(val error: String)

class ApiException(val status: HttpStatusCode, message: String) : RuntimeException(message)

@RestControllerAdvice
class ErrorAdvice {
    @ExceptionHandler(ApiException::class)
    fun handleApi(ex: ApiException): ResponseEntity<ErrorBody> {
        if (ex.status.is5xxServerError) logUnhandled(ex)
        val message = if (ex.status.is5xxServerError) "internal error" else ex.message ?: "error"
        return ResponseEntity.status(ex.status).body(ErrorBody(message))
    }

    @ExceptionHandler(BadInput::class)
    fun handleBad(ex: BadInput): ResponseEntity<ErrorBody> =
        ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorBody(ex.message ?: "bad request"))

    @ExceptionHandler(UnknownStation::class)
    fun handleStation(): ResponseEntity<ErrorBody> =
        ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorBody("unknown station"))

    @ExceptionHandler(NoHandlerFoundException::class)
    fun handleNoHandler(): ResponseEntity<ErrorBody> =
        ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorBody("not found"))

    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun handleBadJson(): ResponseEntity<ErrorBody> =
        ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorBody("Invalid JSON"))

    @ExceptionHandler(Exception::class)
    fun handleOther(ex: Exception): ResponseEntity<ErrorBody> {
        logUnhandled(ex)
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ErrorBody("internal error"))
    }
}

internal fun logUnhandled(cause: Throwable) {
    log(
        "radio-api",
        "error",
        "unhandled",
        mapOf("err" to mapOf("type" to (cause::class.simpleName ?: "Error"), "message" to (cause.message ?: ""))),
    )
}
