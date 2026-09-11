package rssapi.web

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.servlet.NoHandlerFoundException

data class ErrorBody(val error: String)

class ApiException(val status: Int, message: String, cause: Throwable? = null) : RuntimeException(message, cause)

@RestControllerAdvice
class ErrorAdvice {
    @ExceptionHandler(ApiException::class)
    fun handleApi(ex: ApiException): ResponseEntity<ErrorBody> =
        ResponseEntity.status(ex.status).body(ErrorBody(ex.message ?: "error"))

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
    fun handleOther(): ResponseEntity<ErrorBody> =
        ResponseEntity.status(500).body(ErrorBody("internal error"))
}
