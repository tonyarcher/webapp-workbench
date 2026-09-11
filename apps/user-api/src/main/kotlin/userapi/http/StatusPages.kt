package userapi.http

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.plugins.statuspages.StatusPages
import io.ktor.server.response.respond
import kotlinx.serialization.Serializable
import userapi.Settings
import userapi.log.log

@Serializable
data class ErrBody(val err: ErrDetail)

@Serializable
data class ErrDetail(val type: String, val message: String)

fun Application.installStatusPages(settings: Settings) {
    install(StatusPages) {
        exception<Throwable> { call, cause ->
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
            call.respond(
                HttpStatusCode.InternalServerError,
                ErrBody(ErrDetail(cause::class.simpleName ?: "Error", cause.message ?: "")),
            )
        }
    }
}
