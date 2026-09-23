package userapi.web

import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import userapi.Settings
import userapi.accounts.AccountServices
import userapi.accounts.AccountStore
import userapi.accounts.StoredUser
import userapi.accounts.TotpStore
import userapi.domain.clearFailures
import userapi.domain.hashBackupCode
import userapi.domain.isLocked
import userapi.domain.newBackupCodes
import userapi.domain.normalizeUsername
import userapi.domain.otpLooksLikeTotp
import userapi.domain.recordFailure
import userapi.domain.sha256Hex
import userapi.domain.validPassword
import userapi.domain.validUsername
import java.util.UUID

@RestController
class AccountController(
    private val accounts: AccountServices,
    private val settings: Settings,
    private val mapper: ObjectMapper,
) {
    @GetMapping("/csrf", headers = ["X-Api-Version=1"])
    fun csrf(request: HttpServletRequest, response: HttpServletResponse): CsrfBody =
        CsrfBody(csrf = issueCsrf(request, response, settings))

    @GetMapping("/me", headers = ["X-Api-Version=1"])
    fun me(request: HttpServletRequest): MeBody {
        val store = requireStore(accounts)
        val session = requestSession(request)
        val passkeyCount = accounts.passkeys?.store?.countForUser(session.userId) ?: 0
        return MeBody(
            id = session.userId.toString(),
            username = session.username,
            totpEnabled = session.totpEnabled,
            passkeyCount = passkeyCount,
        )
    }

    @PostMapping("/register", headers = ["X-Api-Version=1"])
    fun register(
        @RequestBody body: PasswordBody,
        request: HttpServletRequest,
        response: HttpServletResponse,
    ): ResponseEntity<MeBody> {
        val store = requireStore(accounts)
        checkRate(accounts, "register", request)
        val username = validUsername(body.username)
        if (username == null || !validPassword(body.password, username)) {
            throw ApiException(HttpStatus.BAD_REQUEST, "validation", "username or password does not meet requirements")
        }
        val id = store.createUser(username, accounts.hasher.hash(body.password))
            ?: throw ApiException(HttpStatus.CONFLICT, "conflict", "username taken")
        issueSession(response, settings, store, accounts, id)
        return ResponseEntity.status(HttpStatus.CREATED).body(MeBody(id = id.toString(), username = username))
    }

    @PostMapping("/login", headers = ["X-Api-Version=1"])
    fun login(@RequestBody body: PasswordBody, request: HttpServletRequest, response: HttpServletResponse): Any {
        val store = requireStore(accounts)
        checkRate(accounts, "login", request)
        val username = validUsername(body.username) ?: normalizeUsername(body.username)
        val user = store.findByUsername(username)
        if (!credentialsOk(body.password, user) || user == null) {
            if (user != null && !isLocked(accounts.clock.instant(), user.lockedUntil)) {
                store.writeLockout(user.id, recordFailure(accounts.clock.instant(), user.failedLogins))
            }
            rejectAuth()
        }
        if (totpRequired(user)) {
            startTotpChallenge(response, settings, accounts, user.id)
            return TotpRequiredBody()
        }
        store.writeLockout(user.id, clearFailures())
        issueSession(response, settings, store, accounts, user.id)
        return MeBody(id = user.id.toString(), username = user.username, totpEnabled = false)
    }

    @PostMapping("/login/totp", headers = ["X-Api-Version=1"])
    fun loginTotp(
        @RequestBody body: TotpConfirmBody,
        request: HttpServletRequest,
        response: HttpServletResponse,
    ): MeBody {
        val store = requireStore(accounts)
        val totpStore =
            accounts.totpStore ?: throw ApiException(HttpStatus.SERVICE_UNAVAILABLE, "unavailable", "database offline")
        checkRate(accounts, "login2f", request)
        val pending = pendingToken(request)
        val userId = pending?.let { totpStore.findChallenge(sha256Hex(it), accounts.clock.instant()) }
        if (pending == null || userId == null) rejectAuth()
        return finishTotpLogin(response, store, totpStore, userId, pending, body.code)
    }

    @PostMapping("/logout", headers = ["X-Api-Version=1"])
    fun logout(request: HttpServletRequest, response: HttpServletResponse): OkBody {
        val store = requireStore(accounts)
        sessionToken(request)?.let { store.deleteSession(sha256Hex(it)) }
        clearSessionCookie(response, settings)
        clearPendingCookie(response, settings)
        return OkBody(ok = true)
    }

    private fun finishTotpLogin(
        response: HttpServletResponse,
        store: AccountStore,
        totpStore: TotpStore,
        userId: UUID,
        pendingRaw: String,
        code: String,
    ): MeBody {
        val user = store.findById(userId) ?: rejectAuth()
        val now = accounts.clock.instant()
        if (isLocked(now, user.lockedUntil)) {
            totpStore.deleteChallenge(sha256Hex(pendingRaw))
            clearPendingCookie(response, settings)
            rejectAuth()
        }
        if (!secondFactorOk(totpStore, userId, code)) {
            store.writeLockout(user.id, recordFailure(now, user.failedLogins))
            rejectAuth()
        }
        totpStore.deleteChallenge(sha256Hex(pendingRaw))
        store.writeLockout(user.id, clearFailures())
        clearPendingCookie(response, settings)
        issueSession(response, settings, store, accounts, user.id)
        return MeBody(id = user.id.toString(), username = user.username, totpEnabled = true)
    }

    private fun credentialsOk(password: String, user: StoredUser?): Boolean {
        if (user != null && isLocked(accounts.clock.instant(), user.lockedUntil)) {
            accounts.hasher.verify(password, accounts.dummyHash)
            return false
        }
        val hash = user?.passwordHash ?: accounts.dummyHash
        return accounts.hasher.verify(password, hash) && user != null
    }

    private fun totpRequired(user: StoredUser): Boolean {
        if (user.totpEnabled) return true
        return accounts.totpStore?.enabledSecret(user.id) != null
    }

    private fun secondFactorOk(totpStore: TotpStore, userId: UUID, code: String): Boolean {
        val now = accounts.clock.instant()
        val secret = totpStore.enabledSecret(userId)
        if (secret != null && otpLooksLikeTotp(code) && accounts.totp.verify(secret, code, now)) {
            return true
        }
        return totpStore.consumeBackupHash(userId, hashBackupCode(code))
    }
}
