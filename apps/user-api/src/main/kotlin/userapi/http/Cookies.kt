package userapi.http

import io.ktor.http.Cookie
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond
import io.ktor.http.HttpStatusCode
import userapi.Settings
import userapi.domain.PENDING_MAX_AGE_SEC
import userapi.domain.newToken
import userapi.domain.tokenEquals

const val SESSION_COOKIE = "wb_session"
const val PENDING_COOKIE = "wb_pending"
const val CSRF_COOKIE = "wb_csrf"
const val CSRF_HEADER = "X-CSRF-Token"
const val SESSION_MAX_AGE_SEC = 12 * 60 * 60

fun ApplicationCall.sessionToken(): String? = request.cookies[SESSION_COOKIE]?.ifBlank { null }

fun ApplicationCall.appendSessionCookie(token: String, settings: Settings) {
    response.cookies.append(appCookie(SESSION_COOKIE, token, httpOnly = true, settings = settings))
}

fun ApplicationCall.clearSessionCookie(settings: Settings) {
    response.cookies.append(appCookie(SESSION_COOKIE, "", httpOnly = true, settings = settings, maxAge = 0))
}

fun ApplicationCall.pendingToken(): String? = request.cookies[PENDING_COOKIE]?.ifBlank { null }

fun ApplicationCall.appendPendingCookie(token: String, settings: Settings) {
    response.cookies.append(
        appCookie(PENDING_COOKIE, token, httpOnly = true, settings = settings, maxAge = PENDING_MAX_AGE_SEC),
    )
}

fun ApplicationCall.clearPendingCookie(settings: Settings) {
    response.cookies.append(appCookie(PENDING_COOKIE, "", httpOnly = true, settings = settings, maxAge = 0))
}

fun ApplicationCall.issueCsrf(settings: Settings): String {
    val token = request.cookies[CSRF_COOKIE]?.ifBlank { null } ?: newToken()
    response.cookies.append(appCookie(CSRF_COOKIE, token, httpOnly = false, settings = settings))
    return token
}

suspend fun ApplicationCall.requireCsrf(): Boolean {
    val cookie = request.cookies[CSRF_COOKIE].orEmpty()
    val header = request.headers[CSRF_HEADER].orEmpty()
    if (cookie.isBlank() || header.isBlank() || !tokenEquals(cookie, header)) {
        respond(HttpStatusCode.Forbidden, ErrBody(ErrDetail("csrf", "csrf token mismatch")))
        return false
    }
    return true
}

private fun appCookie(
    name: String,
    value: String,
    httpOnly: Boolean,
    settings: Settings,
    maxAge: Int = SESSION_MAX_AGE_SEC,
): Cookie = Cookie(
    name = name,
    value = value,
    maxAge = maxAge,
    path = "/",
    httpOnly = httpOnly,
    secure = settings.cookieSecure,
    extensions = mapOf("SameSite" to "Lax"),
)
