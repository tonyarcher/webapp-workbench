package userapi.web

import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.HttpMediaTypeNotSupportedException
import org.springframework.web.HttpRequestMethodNotSupportedException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.servlet.NoHandlerFoundException
import userapi.Settings
import userapi.log.log

@RestControllerAdvice
class ErrorAdvice(private val settings: Settings) {
    @ExceptionHandler(ApiException::class)
    fun handleApi(ex: ApiException): ResponseEntity<ErrBody> =
        ResponseEntity.status(ex.status).body(ErrBody(ErrDetail(ex.type, ex.message ?: "error")))

    @ExceptionHandler(OAuthTokenException::class)
    fun handleToken(ex: OAuthTokenException): ResponseEntity<OAuthErrorBody> =
        ResponseEntity.badRequest().body(OAuthErrorBody(ex.error))

    @ExceptionHandler(NoHandlerFoundException::class)
    fun handleNoHandler(): ResponseEntity<ErrBody> =
        ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrBody(ErrDetail("not found", "not found")))

    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun handleBadJson(): ResponseEntity<ErrBody> =
        ResponseEntity.badRequest().body(ErrBody(ErrDetail("validation", "invalid json")))

    @ExceptionHandler(HttpRequestMethodNotSupportedException::class)
    fun handleMethod(): ResponseEntity<ErrBody> =
        ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).body(ErrBody(ErrDetail("method", "method not allowed")))

    @ExceptionHandler(HttpMediaTypeNotSupportedException::class)
    fun handleMediaType(): ResponseEntity<ErrBody> = ResponseEntity.status(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    ).body(ErrBody(ErrDetail("validation", "unsupported media type")))

    @ExceptionHandler(Exception::class)
    fun handleOther(ex: Exception): ResponseEntity<ErrBody> {
        log(
            settings.service,
            "error",
            "unhandled",
            mapOf("err" to mapOf("type" to typeOf(ex), "message" to (ex.message ?: ""))),
            settings.logLevel,
        )
        return ResponseEntity.internalServerError()
            .body(ErrBody(ErrDetail(typeOf(ex), ex.message ?: "")))
    }

    private fun typeOf(ex: Exception): String = ex::class.simpleName ?: "Error"
}
