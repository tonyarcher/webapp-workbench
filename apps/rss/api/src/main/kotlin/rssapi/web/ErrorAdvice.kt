package rssapi.web

import org.springframework.http.HttpStatus
import org.springframework.http.HttpStatusCode
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.servlet.NoHandlerFoundException

data class ErrorBody(val error: String)

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
    fun handleBadJson(): ResponseEntity<ErrorBody> =
        ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorBody("Invalid JSON"))

    @ExceptionHandler(Exception::class)
    fun handleOther(): ResponseEntity<ErrorBody> =
        ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ErrorBody("internal error"))
}
