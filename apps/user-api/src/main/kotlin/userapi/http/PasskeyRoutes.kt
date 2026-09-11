package userapi.http

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import userapi.Settings
import userapi.accounts.AccountServices
import userapi.accounts.PasskeyService

internal suspend fun passkeyRegisterBegin(
    call: ApplicationCall,
    accounts: AccountServices,
) {
    if (!call.requireCsrf()) return
    val store = requireStore(call, accounts) ?: return
    val passkeys = requirePasskeys(call, accounts) ?: return
    val session = currentSession(call, accounts, store) ?: return
    val (id, json) = passkeys.startRegister(session.userId, session.username)
    call.respond(PasskeyBeginBody(requestId = id, options = Json.parseToJsonElement(json)))
}

internal suspend fun passkeyRegisterFinish(
    call: ApplicationCall,
    accounts: AccountServices,
) {
    if (!call.requireCsrf()) return
    val store = requireStore(call, accounts) ?: return
    val passkeys = requirePasskeys(call, accounts) ?: return
    val session = currentSession(call, accounts, store) ?: return
    val body = call.receiveFinish() ?: return
    val credential = Json.encodeToString(JsonElement.serializer(), body.credential)
    passkeys.finishRegister(body.requestId, credential, session.userId)
    call.respond(OkBody(ok = true))
}

internal suspend fun passkeyLoginBegin(call: ApplicationCall, accounts: AccountServices) {
    if (!call.requireCsrf()) return
    if (!accounts.limiter.allow("passkey:" + call.clientIp())) {
        call.rejectRate()
        return
    }
    val passkeys = requirePasskeys(call, accounts) ?: return
    val (id, json) = passkeys.startLogin()
    call.respond(PasskeyBeginBody(requestId = id, options = Json.parseToJsonElement(json)))
}

internal suspend fun passkeyLoginFinish(
    call: ApplicationCall,
    settings: Settings,
    accounts: AccountServices,
) {
    if (!call.requireCsrf()) return
    if (!accounts.limiter.allow("passkey:" + call.clientIp())) {
        call.rejectRate()
        return
    }
    val store = requireStore(call, accounts) ?: return
    val passkeys = requirePasskeys(call, accounts) ?: return
    val body = call.receiveFinish() ?: return
    val credential = Json.encodeToString(JsonElement.serializer(), body.credential)
    val username = passkeys.finishLogin(body.requestId, credential)
    val userId = passkeys.store.userIdForUsername(username) ?: run {
        call.rejectAuth()
        return
    }
    issueSession(call, settings, store, accounts, userId)
    call.respond(MeBody(id = userId.toString(), username = username, totpEnabled = false))
}

internal suspend fun requirePasskeys(call: ApplicationCall, accounts: AccountServices): PasskeyService? {
    val found = accounts.passkeys
    if (found != null) return found
    call.respond(HttpStatusCode.ServiceUnavailable, ErrBody(ErrDetail("unavailable", "passkeys offline")))
    return null
}

private suspend fun ApplicationCall.receiveFinish(): PasskeyFinishBody? {
    return try {
        receive<PasskeyFinishBody>()
    } catch (_: Exception) {
        respond(HttpStatusCode.BadRequest, ErrBody(ErrDetail("validation", "invalid json")))
        null
    }
}
