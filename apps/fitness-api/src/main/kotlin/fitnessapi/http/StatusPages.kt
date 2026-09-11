package fitnessapi.http

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.plugins.statuspages.StatusPages
import io.ktor.server.response.respond
import fitnessapi.Settings
import fitnessapi.log.log

fun Application.installStatusPages(settings: Settings) {
    install(StatusPages) {
        exception<ApiError> { call, cause ->
            val message = if (cause.status >= 500) "internal error" else cause.message ?: "error"
            if (cause.status >= 500) logUnhandled(settings, cause)
            call.respond(HttpStatusCode.fromValue(cause.status), ErrorBody(message))
        }
        exception<Throwable> { call, cause ->
            logUnhandled(settings, cause)
            call.respond(HttpStatusCode.InternalServerError, ErrorBody("internal error"))
        }
        status(HttpStatusCode.NotFound) { call, _ ->
            call.respond(HttpStatusCode.NotFound, ErrorBody("not found"))
        }
    }
}

private fun logUnhandled(settings: Settings, cause: Throwable) {
    log(
        service = settings.service,
        level = "error",
        msg = "unhandled",
        extra = mapOf(
            "err" to mapOf(
                "type" to (cause::class.simpleName ?: "Error"),
                "message" to (cause.message ?: ""),
            ),
        ),
        minLevel = settings.logLevel,
    )
}
