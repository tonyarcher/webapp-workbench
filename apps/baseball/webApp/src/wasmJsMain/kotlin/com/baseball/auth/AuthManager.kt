package com.baseball.auth

import com.baseball.api
import com.baseball.models.RegisterRequestDto
import com.baseball.ui.auth.STATUS_CONNECT
import com.baseball.ui.auth.STATUS_NETWORK
import com.baseball.ui.auth.STATUS_REFUSED
import kotlinx.browser.window
import kotlinx.serialization.json.Json

internal const val KEY_AUTH_TOKEN = "auth_token"
internal const val KEY_ACTIVE_SESSION = "active_session"

var currentUserSession: UserSession? = null

@OptIn(kotlin.js.ExperimentalWasmJsInterop::class)
@JsFun("() => Date.now()")
private external fun getCurrentTimeMillis(): Double

object AuthManager : AuthService {
    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun registerUser(account: UserAccount) {
        val request =
            RegisterRequestDto(
                email = account.email,
                password = account.passwordHash,
                firstName = account.firstName,
                lastName = account.lastName,
            )
        api.register(request)
    }

    override suspend fun login(
        email: String,
        passwordHash: String,
    ): UserSession? {
        try {
            val basicAuth = "Basic " + window.btoa("$email:$passwordHash")
            val userResponse = api.getMe(basicAuth)

            window.localStorage.setItem(KEY_AUTH_TOKEN, basicAuth)

            val session =
                UserSession(
                    email = userResponse.email,
                    firstName = userResponse.firstName,
                    expiresAtMillis = getCurrentTimeMillis() + (30.0 * 24 * 60 * 60 * 1000),
                )
            saveSession(session)
            return session
        } catch (e: IllegalStateException) {
            val msg = e.message ?: ""
            if (msg.contains(STATUS_CONNECT, ignoreCase = true) ||
                msg.contains(STATUS_REFUSED, ignoreCase = true) ||
                msg.contains(STATUS_NETWORK, ignoreCase = true)
            ) {
                throw e
            }
            println("Login failed: ${e.message}")
            window.localStorage.removeItem(KEY_AUTH_TOKEN)
            return null
        }
    }

    override fun logout() {
        currentUserSession = null
        window.localStorage.removeItem(KEY_ACTIVE_SESSION)
        window.localStorage.removeItem(KEY_AUTH_TOKEN)
        window.location.hash = "welcome"
    }

    override fun saveSession(session: UserSession) {
        currentUserSession = session
        val sessionJson = json.encodeToString(UserSession.serializer(), session)
        window.localStorage.setItem(KEY_ACTIVE_SESSION, sessionJson)
    }

    override fun refreshSession() {
        val session = currentUserSession ?: return
        val newSession =
            session.copy(
                expiresAtMillis = getCurrentTimeMillis() + (30.0 * 24 * 60 * 60 * 1000),
            )
        saveSession(newSession)
    }

    override fun loadSession(): Boolean {
        val sessionJson = window.localStorage.getItem(KEY_ACTIVE_SESSION)
        var result = false
        if (sessionJson != null) {
            try {
                val session = json.decodeFromString(UserSession.serializer(), sessionJson)
                if (session.expiresAtMillis > getCurrentTimeMillis()) {
                    currentUserSession = session
                    refreshSession()
                    result = true
                } else {
                    window.localStorage.removeItem(KEY_ACTIVE_SESSION)
                    window.localStorage.removeItem(KEY_AUTH_TOKEN)
                }
            } catch (ignored: Throwable) {
                println("Failed to load session: ${ignored.message}")
            }
        }
        return result
    }
}
