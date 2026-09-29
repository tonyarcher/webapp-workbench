package userapi.accounts

import java.time.Instant
import java.util.UUID

/**
 * @property nonce the `nonce` the client sent on /oauth/authorize, or empty when
 *   it sent none. OIDC Core 3.1.3.7 requires the id_token to carry it back
 *   unchanged, and a client that sent one refuses a token without it, so it has
 *   to survive the code exchange rather than be read from the callback.
 */
data class StoredAuthCode(
    val userId: UUID,
    val clientId: String,
    val redirectUri: String,
    val codeChallenge: String,
    val nonce: String = "",
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
        nonce: String = "",
    )

    /**
     * Consume an auth code, but only if every caller-supplied field matches.
     *
     * All four conditions sit in the DELETE rather than being checked afterwards,
     * because a code that is deleted before it is validated cannot be retried.
     * Go's x/oauth2 tries HTTP Basic auth first, which leaves client_id out of
     * the form entirely; the first exchange then failed the client check and
     * destroyed the code, so the corrected retry found nothing and every
     * authorization_code grant from a Go client failed twice.
     *
     * [codeChallenge] is the challenge derived from the presented verifier, not
     * the stored one, so PKCE is verified in the same atomic step.
     */
    fun takeAuthCode(
        codeHash: String,
        now: Instant,
        clientId: String,
        redirectUri: String,
        codeChallenge: String,
        allowMissingChallenge: Boolean = false,
    ): StoredAuthCode?
    fun insertRefresh(tokenHash: String, familyId: UUID, userId: UUID, clientId: String, expiresAt: Instant)
    fun takeRefresh(tokenHash: String, now: Instant): StoredRefresh?
    fun revokeFamily(familyId: UUID)
}

data class StoredRefresh(val familyId: UUID, val userId: UUID, val clientId: String, val revoked: Boolean)
