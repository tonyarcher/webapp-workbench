package userapi.accounts

import userapi.crypto.AUTH_CODE_TTL_SEC
import userapi.crypto.JwtSigner
import userapi.crypto.REFRESH_TTL_SEC
import userapi.domain.OAuthClient
import userapi.domain.newToken
import userapi.domain.pkceS256
import userapi.domain.redirectAllowed
import userapi.domain.sha256Hex
import userapi.domain.validCodeVerifier
import java.time.Clock
import java.time.Duration
import java.util.UUID

data class TokenPair(val accessToken: String, val refreshToken: String, val expiresIn: Int)

class OAuthService(val store: OAuthStore, val signer: JwtSigner, val clock: Clock) {
    fun client(id: String): OAuthClient? = store.findClient(id)

    fun allowedRedirect(clientId: String, redirectUri: String): Boolean {
        val found = client(clientId) ?: return false
        return redirectAllowed(found, redirectUri)
    }

    fun issueCode(userId: UUID, clientId: String, redirectUri: String, codeChallenge: String): String {
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
        // Every check is part of the take, so a rejected attempt leaves the code
        // usable. Verifying afterwards deleted the code first, and a client that
        // omits client_id on its first exchange -- which Go's x/oauth2 does while
        // probing Basic auth -- then had nothing left to retry with.
        if (!validCodeVerifier(verifier)) return null
        val row = store.takeAuthCode(
            codeHash = sha256Hex(code),
            now = clock.instant(),
            clientId = clientId,
            redirectUri = redirectUri,
            codeChallenge = pkceS256(verifier),
        ) ?: return null
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
