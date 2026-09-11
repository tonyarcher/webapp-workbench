package userapi.http

import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond
import userapi.Settings
import userapi.accounts.AccountServices
import userapi.accounts.AccountStore
import userapi.accounts.StoredUser
import userapi.domain.clearFailures
import userapi.domain.isLocked
import userapi.domain.normalizeUsername
import userapi.domain.recordFailure
import userapi.domain.validUsername

internal suspend fun loginUser(
    call: ApplicationCall,
    settings: Settings,
    accounts: AccountServices,
) {
    if (!call.requireCsrf()) return
    val store = requireStore(call, accounts) ?: return
    if (!accounts.limiter.allow("login:" + call.clientIp())) {
        call.rejectRate()
        return
    }
    val body = call.receivePasswordBody() ?: return
    val username = validUsername(body.username) ?: normalizeUsername(body.username)
    val user = store.findByUsername(username)
    completeLogin(call, settings, accounts, store, user, body.password)
}

private suspend fun completeLogin(
    call: ApplicationCall,
    settings: Settings,
    accounts: AccountServices,
    store: AccountStore,
    user: StoredUser?,
    password: String,
) {
    if (!credentialsOk(accounts, password, user) || user == null) {
        if (user != null && !isLocked(accounts.clock.instant(), user.lockedUntil)) {
            store.writeLockout(user.id, recordFailure(accounts.clock.instant(), user.failedLogins))
        }
        call.rejectAuth()
        return
    }
    if (totpRequired(accounts, user)) {
        startTotpChallenge(call, settings, accounts, user.id)
        call.respond(TotpRequiredBody())
        return
    }
    store.writeLockout(user.id, clearFailures())
    issueSession(call, settings, store, accounts, user.id)
    call.respond(MeBody(id = user.id.toString(), username = user.username, totpEnabled = false))
}

internal fun totpRequired(accounts: AccountServices, user: StoredUser): Boolean {
    if (user.totpEnabled) return true
    return accounts.totpStore?.enabledSecret(user.id) != null
}

internal fun credentialsOk(
    accounts: AccountServices,
    password: String,
    user: StoredUser?,
): Boolean {
    if (user != null && isLocked(accounts.clock.instant(), user.lockedUntil)) {
        accounts.hasher.verify(password, accounts.dummyHash)
        return false
    }
    val hash = user?.passwordHash ?: accounts.dummyHash
    return accounts.hasher.verify(password, hash) && user != null
}
