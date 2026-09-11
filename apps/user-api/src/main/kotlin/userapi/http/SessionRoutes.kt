package userapi.http

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond
import userapi.Settings
import userapi.accounts.AccountServices
import userapi.domain.sha256Hex

internal suspend fun respondMe(call: ApplicationCall, accounts: AccountServices) {
    val store = requireStore(call, accounts) ?: return
    val raw = call.sessionToken()
    if (raw == null) {
        call.respond(HttpStatusCode.Unauthorized, ErrBody(ErrDetail("unauthorized", "not signed in")))
        return
    }
    val session = store.findSession(sha256Hex(raw), accounts.clock.instant())
    if (session == null) {
        call.respond(HttpStatusCode.Unauthorized, ErrBody(ErrDetail("unauthorized", "not signed in")))
        return
    }
    call.respond(MeBody(id = session.userId.toString(), username = session.username))
}

internal suspend fun logoutUser(call: ApplicationCall, settings: Settings, accounts: AccountServices) {
    if (!call.requireCsrf()) return
    val store = requireStore(call, accounts) ?: return
    val raw = call.sessionToken()
    if (raw != null) store.deleteSession(sha256Hex(raw))
    call.clearSessionCookie(settings)
    call.respond(OkBody(ok = true))
}
