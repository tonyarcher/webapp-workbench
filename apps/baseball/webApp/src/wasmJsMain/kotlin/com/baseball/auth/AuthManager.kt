package com.baseball.auth

import com.baseball.api.RegisterRequestDto
import com.baseball.api
import com.baseball.Constants
import kotlinx.browser.window
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

var currentUserSession: UserSession? = null

@JsFun("() => Date.now()")
private external fun getCurrentTimeMillis(): Double

object AuthManager : AuthService {
    private val json = Json { ignoreUnknownKeys = true }
    
    override suspend fun registerUser(account: UserAccount) {
        val request = RegisterRequestDto(
            email = account.email,
            password = account.passwordHash,
            firstName = account.firstName,
            lastName = account.lastName
        )
        api.register(request)
    }
    
    override suspend fun login(email: String, passwordHash: String): UserSession? {
        try {
            val basicAuth = "Basic " + window.btoa("$email:$passwordHash")
            val userResponse = api.getMe(basicAuth)
            
            window.localStorage.setItem(Constants.KEY_AUTH_TOKEN, basicAuth)
            
            val session = UserSession(
                email = userResponse.email,
                firstName = userResponse.firstName,
                expiresAtMillis = getCurrentTimeMillis() + (30.0 * 24 * 60 * 60 * 1000)
            )
            saveSession(session)
            return session
        } catch (e: Throwable) {
            val msg = e.message ?: ""
            if (msg.contains(Constants.STATUS_CONNECT, ignoreCase = true) || msg.contains(Constants.STATUS_REFUSED, ignoreCase = true) || msg.contains(Constants.STATUS_NETWORK, ignoreCase = true)) {
                throw e
            }
            println("Login failed: ${e.message}")
            window.localStorage.removeItem(Constants.KEY_AUTH_TOKEN)
            return null
        }
     }
     
     override fun logout() {
         currentUserSession = null
         window.localStorage.removeItem(Constants.KEY_ACTIVE_SESSION)
         window.localStorage.removeItem(Constants.KEY_AUTH_TOKEN)
         window.location.hash = "welcome"
     }
     
     override fun saveSession(session: UserSession) {
         currentUserSession = session
         window.localStorage.setItem(Constants.KEY_ACTIVE_SESSION, json.encodeToString(UserSession.serializer(), session))
     }
     
     override fun refreshSession() {
         val session = currentUserSession ?: return
         val newSession = session.copy(
             expiresAtMillis = getCurrentTimeMillis() + (30.0 * 24 * 60 * 60 * 1000)
         )
         saveSession(newSession)
     }
     
     override fun loadSession(): Boolean {
         val sessionJson = window.localStorage.getItem(Constants.KEY_ACTIVE_SESSION) ?: return false
         return try {
             val session = json.decodeFromString(UserSession.serializer(), sessionJson)
             if (session.expiresAtMillis > getCurrentTimeMillis()) {
                 currentUserSession = session
                 refreshSession()
                 return true
             } else {
                 window.localStorage.removeItem(Constants.KEY_ACTIVE_SESSION)
                 window.localStorage.removeItem(Constants.KEY_AUTH_TOKEN)
                false
            }
        } catch (e: Exception) {
            false
        }
    }
}
