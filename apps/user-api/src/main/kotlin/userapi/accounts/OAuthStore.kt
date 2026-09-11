package userapi.accounts

import java.time.Instant
import java.util.UUID

data class StoredAuthCode(
    val userId: UUID,
    val clientId: String,
    val redirectUri: String,
    val codeChallenge: String,
)

interface OAuthStore {
    fun findClient(clientId: String): userapi.domain.OAuthClient?
    fun loadSigningJwk(): String?
    fun saveSigningJwk(kid: String, jwk: String)
    fun insertAuthCode(
        codeHash: String,
        userId: UUID,
        clientId: String,
        redirectUri: String,
        codeChallenge: String,
        expiresAt: Instant,
    )
    fun takeAuthCode(codeHash: String, now: Instant): StoredAuthCode?
    fun insertRefresh(
        tokenHash: String,
        familyId: UUID,
        userId: UUID,
        clientId: String,
        expiresAt: Instant,
    )
    fun takeRefresh(tokenHash: String, now: Instant): StoredRefresh?
    fun revokeFamily(familyId: UUID)
}

data class StoredRefresh(
    val familyId: UUID,
    val userId: UUID,
    val clientId: String,
    val revoked: Boolean,
)
