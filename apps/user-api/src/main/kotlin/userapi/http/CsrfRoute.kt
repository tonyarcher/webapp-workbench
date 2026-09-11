package userapi.http

import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond
import userapi.Settings

internal suspend fun issueCsrfJson(call: ApplicationCall, settings: Settings) {
    val token = call.issueCsrf(settings)
    call.respond(CsrfBody(csrf = token))
}
