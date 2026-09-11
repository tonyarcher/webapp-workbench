package userapi.http

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond
import java.time.Duration
import java.util.UUID
import userapi.Settings
import userapi.accounts.AccountServices
import userapi.accounts.AccountStore
import userapi.domain.newToken
import userapi.domain.sha256Hex
import userapi.domain.validPassword
import userapi.domain.validUsername

internal suspend fun registerUser(
    call: ApplicationCall,
    settings: Settings,
    accounts: AccountServices,
) {
    if (!call.requireCsrf()) return
    val store = requireStore(call, accounts) ?: return
    if (!accounts.limiter.allow("register:" + call.clientIp())) {
        call.rejectRate()
        return
    }
    val body = call.receivePasswordBody() ?: return
    val username = validUsername(body.username)
    if (username == null || !validPassword(body.password, username)) {
        call.respond(
            HttpStatusCode.BadRequest,
            ErrBody(ErrDetail("validation", "username or password does not meet requirements")),
        )
        return
    }
    finishRegister(call, settings, accounts, store, username, body.password)
}

private suspend fun finishRegister(
    call: ApplicationCall,
    settings: Settings,
    accounts: AccountServices,
    store: AccountStore,
    username: String,
    password: String,
) {
    val id = store.createUser(username, accounts.hasher.hash(password))
    if (id == null) {
        call.respond(HttpStatusCode.Conflict, ErrBody(ErrDetail("conflict", "username taken")))
        return
    }
    issueSession(call, settings, store, accounts, id)
    call.respond(HttpStatusCode.Created, MeBody(id = id.toString(), username = username))
}

internal fun issueSession(
    call: ApplicationCall,
    settings: Settings,
    store: AccountStore,
    accounts: AccountServices,
    userId: UUID,
) {
    val raw = newToken()
    val expires = accounts.clock.instant().plus(Duration.ofSeconds(SESSION_MAX_AGE_SEC.toLong()))
    store.insertSession(userId, sha256Hex(raw), expires)
    call.appendSessionCookie(raw, settings)
}
