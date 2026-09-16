package userapi.web

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpHeaders
import org.springframework.http.ResponseCookie
import userapi.Settings
import userapi.domain.PENDING_MAX_AGE_SEC
import userapi.domain.newToken
import java.time.Duration

const val SESSION_COOKIE: String = "wb_session"
const val PENDING_COOKIE: String = "wb_pending"
const val CSRF_COOKIE: String = "wb_csrf"
const val CSRF_HEADER: String = "X-CSRF-Token"
const val SESSION_MAX_AGE_SEC: Int = 12 * 60 * 60

fun HttpServletRequest.cookieValue(name: String): String? =
    cookies?.firstOrNull { it.name == name }?.value?.ifBlank { null }

fun sessionToken(request: HttpServletRequest): String? = request.cookieValue(SESSION_COOKIE)

fun pendingToken(request: HttpServletRequest): String? = request.cookieValue(PENDING_COOKIE)

fun setCookie(response: HttpServletResponse, cookie: ResponseCookie) {
    response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString())
}

fun appendSessionCookie(response: HttpServletResponse, token: String, settings: Settings) {
    setCookie(response, appCookie(SESSION_COOKIE, token, httpOnly = true, settings = settings))
}

fun clearSessionCookie(response: HttpServletResponse, settings: Settings) {
    setCookie(response, appCookie(SESSION_COOKIE, "", httpOnly = true, settings = settings, maxAge = 0))
}

fun appendPendingCookie(response: HttpServletResponse, token: String, settings: Settings) {
    setCookie(
        response,
        appCookie(PENDING_COOKIE, token, httpOnly = true, settings = settings, maxAge = PENDING_MAX_AGE_SEC),
    )
}

fun clearPendingCookie(response: HttpServletResponse, settings: Settings) {
    setCookie(response, appCookie(PENDING_COOKIE, "", httpOnly = true, settings = settings, maxAge = 0))
}

fun issueCsrf(request: HttpServletRequest, response: HttpServletResponse, settings: Settings): String {
    val token = request.cookieValue(CSRF_COOKIE) ?: newToken()
    setCookie(response, appCookie(CSRF_COOKIE, token, httpOnly = false, settings = settings))
    return token
}

private fun appCookie(
    name: String,
    value: String,
    httpOnly: Boolean,
    settings: Settings,
    maxAge: Int = SESSION_MAX_AGE_SEC,
): ResponseCookie = ResponseCookie.from(name, value)
    .httpOnly(httpOnly)
    .secure(settings.cookieSecure)
    .path("/")
    .maxAge(Duration.ofSeconds(maxAge.toLong()))
    .sameSite("Lax")
    .build()
