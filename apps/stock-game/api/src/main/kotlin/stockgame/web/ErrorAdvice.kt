package stockgame.web

import org.springframework.http.HttpStatus
import org.springframework.http.HttpStatusCode
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.MissingServletRequestParameterException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException
import org.springframework.web.servlet.NoHandlerFoundException
import stockgame.domain.ProviderError
import stockgame.domain.TradingError
import stockgame.log.log

data class ErrorBody(val error: String)

class ApiException(val status: HttpStatusCode, message: String) : RuntimeException(message)

@RestControllerAdvice
class ErrorAdvice {
    @ExceptionHandler(ApiException::class)
    fun handleApi(ex: ApiException): ResponseEntity<ErrorBody> =
        ResponseEntity.status(ex.status).body(ErrorBody(ex.message ?: "error"))

    @ExceptionHandler(TradingError::class)
    fun handleTrade(ex: TradingError): ResponseEntity<ErrorBody> =
        ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorBody(ex.message ?: "error"))

    @ExceptionHandler(ProviderError::class)
    fun handleProvider(ex: ProviderError): ResponseEntity<ErrorBody> =
        ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(ErrorBody(ex.message ?: "error"))

    @ExceptionHandler(NoHandlerFoundException::class)
    fun handleNoHandler(): ResponseEntity<ErrorBody> =
        ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorBody("not found"))

    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun handleBadJson(): ResponseEntity<ErrorBody> =
        ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorBody("Invalid JSON"))

    @ExceptionHandler(
        MissingServletRequestParameterException::class,
        MethodArgumentTypeMismatchException::class,
    )
    fun handleBadParam(): ResponseEntity<ErrorBody> =
        ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorBody("invalid request"))

    @ExceptionHandler(Exception::class)
    fun handleOther(ex: Exception): ResponseEntity<ErrorBody> {
        log(
            "stock-game-api",
            "error",
            "unhandled",
            mapOf("err" to mapOf("type" to (ex::class.simpleName ?: "Error"), "message" to (ex.message ?: ""))),
        )
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ErrorBody("internal error"))
    }
}
