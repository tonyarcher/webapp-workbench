package userapi.accounts

import java.time.Clock
import java.time.Duration
import java.util.UUID
import userapi.crypto.AUTH_CODE_TTL_SEC
import userapi.crypto.JwtSigner
import userapi.crypto.REFRESH_TTL_SEC
import userapi.domain.OAuthClient
import userapi.domain.newToken
import userapi.domain.pkceMatches
import userapi.domain.redirectAllowed
import userapi.domain.sha256Hex

data class TokenPair(val accessToken: String, val refreshToken: String, val expiresIn: Int)

class OAuthService(
    val store: OAuthStore,
    val signer: JwtSigner,
    val clock: Clock,
) {
    fun client(id: String): OAuthClient? = store.findClient(id)

    fun allowedRedirect(clientId: String, redirectUri: String): Boolean {
        val found = client(clientId) ?: return false
        return redirectAllowed(found, redirectUri)
    }

    fun issueCode(
        userId: UUID,
        clientId: String,
        redirectUri: String,
        codeChallenge: String,
    ): String {
        val raw = newToken()
        val expires = clock.instant().plus(Duration.ofSeconds(AUTH_CODE_TTL_SEC.toLong()))
        store.insertAuthCode(sha256Hex(raw), userId, clientId, redirectUri, codeChallenge, expires)
        return raw
    }

    fun exchangeCode(
        code: String,
        clientId: String,
        redirectUri: String,
        verifier: String,
        usernameLookup: (UUID) -> String?,
    ): TokenPair? {
        val row = store.takeAuthCode(sha256Hex(code), clock.instant()) ?: return null
        if (row.clientId != clientId || row.redirectUri != redirectUri) return null
        if (!pkceMatches(verifier, row.codeChallenge)) return null
        val username = usernameLookup(row.userId) ?: return null
        return issueTokens(row.userId, username, clientId, UUID.randomUUID())
    }

    fun rotateRefresh(refreshRaw: String, usernameLookup: (UUID) -> String?): TokenPair? {
        val row = store.takeRefresh(sha256Hex(refreshRaw), clock.instant()) ?: return null
        if (row.revoked) {
            store.revokeFamily(row.familyId)
            return null
        }
        val username = usernameLookup(row.userId) ?: return null
        return issueTokens(row.userId, username, row.clientId, row.familyId)
    }

    private fun issueTokens(userId: UUID, username: String, clientId: String, familyId: UUID): TokenPair {
        val now = clock.instant()
        val access = signer.accessToken(userId, username, clientId, now)
        val refresh = newToken()
        val expires = now.plus(Duration.ofSeconds(REFRESH_TTL_SEC.toLong()))
        store.insertRefresh(sha256Hex(refresh), familyId, userId, clientId, expires)
        return TokenPair(access, refresh, userapi.crypto.ACCESS_TTL_SEC)
    }
}
