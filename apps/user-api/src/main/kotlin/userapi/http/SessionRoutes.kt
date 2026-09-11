package userapi.http

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond
import userapi.Settings
import userapi.accounts.AccountServices
import userapi.accounts.AccountStore
import userapi.accounts.StoredSession
import userapi.domain.sha256Hex

internal suspend fun respondMe(call: ApplicationCall, accounts: AccountServices) {
    val store = requireStore(call, accounts) ?: return
    val session = currentSession(call, accounts, store) ?: return
    val passkeyCount = accounts.passkeys?.store?.countForUser(session.userId) ?: 0
    call.respond(
        MeBody(
            id = session.userId.toString(),
            username = session.username,
            totpEnabled = session.totpEnabled,
            passkeyCount = passkeyCount,
        ),
    )
}

internal fun peekSession(
    call: ApplicationCall,
    accounts: AccountServices,
    store: AccountStore,
): StoredSession? {
    val raw = call.sessionToken() ?: return null
    return store.findSession(sha256Hex(raw), accounts.clock.instant())
}

internal suspend fun currentSession(
    call: ApplicationCall,
    accounts: AccountServices,
    store: AccountStore,
): StoredSession? {
    val raw = call.sessionToken()
    if (raw == null) {
        call.respond(HttpStatusCode.Unauthorized, ErrBody(ErrDetail("unauthorized", "not signed in")))
        return null
    }
    val session = store.findSession(sha256Hex(raw), accounts.clock.instant())
    if (session == null) {
        call.respond(HttpStatusCode.Unauthorized, ErrBody(ErrDetail("unauthorized", "not signed in")))
        return null
    }
    return session
}

internal suspend fun logoutUser(call: ApplicationCall, settings: Settings, accounts: AccountServices) {
    if (!call.requireCsrf()) return
    val store = requireStore(call, accounts) ?: return
    val raw = call.sessionToken()
    if (raw != null) store.deleteSession(sha256Hex(raw))
    call.clearSessionCookie(settings)
    call.clearPendingCookie(settings)
    call.respond(OkBody(ok = true))
}
