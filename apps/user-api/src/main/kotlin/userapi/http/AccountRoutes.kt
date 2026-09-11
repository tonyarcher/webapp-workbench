package userapi.http

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.routing
import userapi.Settings
import userapi.accounts.AccountServices
import userapi.accounts.AccountStore

fun Application.accountRoutes(settings: Settings, accounts: AccountServices) {
    routing {
        get("/v1/csrf") { issueCsrfJson(call, settings) }
        get("/v1/me") { respondMe(call, accounts) }
        post("/v1/register") { registerUser(call, settings, accounts) }
        post("/v1/login") { loginUser(call, settings, accounts) }
        post("/v1/login/totp") { loginTotp(call, settings, accounts) }
        post("/v1/logout") { logoutUser(call, settings, accounts) }
        post("/v1/totp/begin") { totpBegin(call, accounts) }
        post("/v1/totp/confirm") { totpConfirm(call, accounts) }
    }
}

internal suspend fun requireStore(call: ApplicationCall, accounts: AccountServices): AccountStore? {
    val store = accounts.store
    if (store != null) return store
    call.respond(
        HttpStatusCode.ServiceUnavailable,
        ErrBody(ErrDetail("unavailable", "database offline")),
    )
    return null
}
