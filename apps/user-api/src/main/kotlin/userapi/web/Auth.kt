package userapi.web

import jakarta.servlet.http.HttpServletRequest
import java.time.Duration
import java.util.UUID
import userapi.Settings
import userapi.accounts.AccountServices
import userapi.accounts.AccountStore
import userapi.accounts.StoredSession
import userapi.domain.PENDING_MAX_AGE_SEC
import userapi.domain.newToken
import userapi.domain.sha256Hex

class ApiException(val status: Int, val type: String, message: String) : RuntimeException(message)

class OAuthTokenException(val error: String) : RuntimeException(error)

const val SESSION_ATTR: String = "userapi.session"

fun requestSession(request: HttpServletRequest): StoredSession =
    request.getAttribute(SESSION_ATTR) as StoredSession?
        ?: throw ApiException(401, "unauthorized", "not signed in")

fun peekSession(request: HttpServletRequest): StoredSession? =
    request.getAttribute(SESSION_ATTR) as StoredSession?

fun requireStore(accounts: AccountServices): AccountStore =
    accounts.store ?: throw ApiException(503, "unavailable", "database offline")

fun rejectRate(): Nothing = throw ApiException(429, "rate", "too many attempts")

fun rejectAuth(): Nothing = throw ApiException(401, "unauthorized", "invalid credentials")

fun HttpServletRequest.clientIp(): String {
    val real = getHeader("X-Real-IP")?.trim().orEmpty()
    if (real.isNotBlank()) return real.take(64)
    return remoteAddr.take(64)
}

fun checkRate(accounts: AccountServices, key: String, request: HttpServletRequest) {
    if (!accounts.limiter.allow("$key:" + request.clientIp())) rejectRate()
}

fun issueSession(
    response: jakarta.servlet.http.HttpServletResponse,
    settings: Settings,
    store: AccountStore,
    accounts: AccountServices,
    userId: UUID,
) {
    val raw = newToken()
    val expires = accounts.clock.instant().plus(Duration.ofSeconds(SESSION_MAX_AGE_SEC.toLong()))
    store.insertSession(userId, sha256Hex(raw), expires)
    appendSessionCookie(response, raw, settings)
}

fun startTotpChallenge(
    response: jakarta.servlet.http.HttpServletResponse,
    settings: Settings,
    accounts: AccountServices,
    userId: UUID,
) {
    val totpStore = accounts.totpStore ?: return
    val raw = newToken()
    val expires = accounts.clock.instant().plus(Duration.ofSeconds(PENDING_MAX_AGE_SEC.toLong()))
    totpStore.insertChallenge(userId, sha256Hex(raw), expires)
    appendPendingCookie(response, raw, settings)
}
