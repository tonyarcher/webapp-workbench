

package com.baseball.auth

import kotlinx.serialization.Serializable

@Serializable
data class UserAccount(
    val email: String,
    val firstName: String,
    val lastName: String,
    val passwordHash: String,
)

@Serializable
data class UserSession(
    val email: String,
    val firstName: String,
    val expiresAtMillis: Double,
)

interface AuthService {
    suspend fun registerUser(account: UserAccount)

    suspend fun login(
        email: String,
        passwordHash: String,
    ): UserSession?

    fun logout()

    fun saveSession(session: UserSession)

    fun refreshSession()

    fun loadSession(): Boolean
}
