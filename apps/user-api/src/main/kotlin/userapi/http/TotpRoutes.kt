package userapi.http

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import java.time.Duration
import java.util.UUID
import userapi.Settings
import userapi.accounts.AccountServices
import userapi.accounts.TotpStore
import userapi.domain.PENDING_MAX_AGE_SEC
import userapi.domain.clearFailures
import userapi.domain.hashBackupCode
import userapi.domain.isLocked
import userapi.domain.newBackupCodes
import userapi.domain.newToken
import userapi.domain.otpLooksLikeTotp
import userapi.domain.recordFailure
import userapi.domain.sha256Hex

internal suspend fun requireTotpStore(call: ApplicationCall, accounts: AccountServices): TotpStore? {
    val store = accounts.totpStore
    if (store != null) return store
    call.respond(
        HttpStatusCode.ServiceUnavailable,
        ErrBody(ErrDetail("unavailable", "database offline")),
    )
    return null
}

internal fun startTotpChallenge(
    call: ApplicationCall,
    settings: Settings,
    accounts: AccountServices,
    userId: UUID,
) {
    val totpStore = accounts.totpStore ?: return
    val raw = newToken()
    val expires = accounts.clock.instant().plus(Duration.ofSeconds(PENDING_MAX_AGE_SEC.toLong()))
    totpStore.insertChallenge(userId, sha256Hex(raw), expires)
    call.appendPendingCookie(raw, settings)
}

internal suspend fun loginTotp(call: ApplicationCall, settings: Settings, accounts: AccountServices) {
    if (!call.requireCsrf()) return
    val store = requireStore(call, accounts) ?: return
    val totpStore = requireTotpStore(call, accounts) ?: return
    if (!accounts.limiter.allow("login2f:" + call.clientIp())) {
        call.rejectRate()
        return
    }
    val body = call.receiveCode() ?: return
    val pending = call.pendingToken()
    val userId = pending?.let { totpStore.findChallenge(sha256Hex(it), accounts.clock.instant()) }
    if (pending == null || userId == null) {
        call.rejectAuth()
        return
    }
    finishTotpLogin(call, settings, accounts, store, totpStore, userId, pending, body.code)
}

private suspend fun finishTotpLogin(
    call: ApplicationCall,
    settings: Settings,
    accounts: AccountServices,
    store: userapi.accounts.AccountStore,
    totpStore: TotpStore,
    userId: UUID,
    pendingRaw: String,
    code: String,
) {
    val user = store.findById(userId)
    val now = accounts.clock.instant()
    if (user == null) {
        call.rejectAuth()
        return
    }
    if (isLocked(now, user.lockedUntil)) {
        totpStore.deleteChallenge(sha256Hex(pendingRaw))
        call.clearPendingCookie(settings)
        call.rejectAuth()
        return
    }
    if (!secondFactorOk(accounts, totpStore, userId, code)) {
        store.writeLockout(user.id, recordFailure(now, user.failedLogins))
        call.rejectAuth()
        return
    }
    totpStore.deleteChallenge(sha256Hex(pendingRaw))
    store.writeLockout(user.id, clearFailures())
    call.clearPendingCookie(settings)
    issueSession(call, settings, store, accounts, user.id)
    call.respond(MeBody(id = user.id.toString(), username = user.username, totpEnabled = true))
}

internal fun secondFactorOk(
    accounts: AccountServices,
    totpStore: TotpStore,
    userId: UUID,
    code: String,
): Boolean {
    val now = accounts.clock.instant()
    val secret = totpStore.enabledSecret(userId)
    if (secret != null && otpLooksLikeTotp(code) && accounts.totp.verify(secret, code, now)) {
        return true
    }
    return totpStore.consumeBackupHash(userId, hashBackupCode(code))
}

internal suspend fun totpBegin(call: ApplicationCall, accounts: AccountServices) {
    if (!call.requireCsrf()) return
    val store = requireStore(call, accounts) ?: return
    val totpStore = requireTotpStore(call, accounts) ?: return
    val session = currentSession(call, accounts, store) ?: return
    if (session.totpEnabled) {
        call.respond(HttpStatusCode.Conflict, ErrBody(ErrDetail("conflict", "totp already enabled")))
        return
    }
    val secret = accounts.totp.newSecret()
    totpStore.setPendingSecret(session.userId, secret)
    call.respond(TotpBeginBody(secret = secret, otpauth = accounts.totp.otpauth(session.username, secret)))
}

internal suspend fun totpConfirm(call: ApplicationCall, accounts: AccountServices) {
    if (!call.requireCsrf()) return
    val store = requireStore(call, accounts) ?: return
    val totpStore = requireTotpStore(call, accounts) ?: return
    val session = currentSession(call, accounts, store) ?: return
    val body = call.receiveCode() ?: return
    val pending = totpStore.pendingSecret(session.userId)
    if (pending == null || !accounts.totp.verify(pending, body.code, accounts.clock.instant())) {
        call.respond(HttpStatusCode.Unauthorized, ErrBody(ErrDetail("unauthorized", "invalid authenticator code")))
        return
    }
    val codes = newBackupCodes()
    totpStore.enableSecret(session.userId, pending)
    totpStore.replaceBackupHashes(session.userId, codes.map { hashBackupCode(it) })
    call.respond(BackupCodesBody(backupCodes = codes))
}

private suspend fun ApplicationCall.receiveCode(): TotpConfirmBody? {
    return try {
        receive<TotpConfirmBody>()
    } catch (_: Exception) {
        respond(HttpStatusCode.BadRequest, ErrBody(ErrDetail("validation", "invalid json")))
        null
    }
}
