package userapi.accounts

import java.time.Instant
import java.util.UUID
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.transaction.annotation.Transactional
import userapi.persist.AuthCodeEntity
import userapi.persist.AuthCodeRepo
import userapi.persist.OAuthClientRepo
import userapi.persist.RedirectUriRepo
import userapi.persist.RefreshTokenEntity
import userapi.persist.RefreshTokenRepo
import userapi.persist.SigningKeyEntity
import userapi.persist.SigningKeyRepo

open class JpaOAuthStore(
    private val clients: OAuthClientRepo,
    private val redirectUris: RedirectUriRepo,
    private val signingKeys: SigningKeyRepo,
    private val authCodes: AuthCodeRepo,
    private val refreshTokens: RefreshTokenRepo,
) : OAuthStore {
    override fun findClient(clientId: String): userapi.domain.OAuthClient? {
        if (!clients.existsById(clientId)) return null
        val uris = redirectUris.findByClientId(clientId).map { it.redirectUri }.toSet()
        if (uris.isEmpty()) return null
        return userapi.domain.OAuthClient(clientId, uris)
    }

    override fun loadSigningJwk(): String? =
        signingKeys.findFirstByOrderByCreatedAtDesc()?.jwk

    override fun saveSigningJwk(kid: String, jwk: String) {
        if (signingKeys.existsById(kid)) return
        try {
            signingKeys.save(SigningKeyEntity(kid = kid, jwk = jwk))
        } catch (_: DataIntegrityViolationException) {
            // Lost a concurrent insert race; the other writer won.
        }
    }

    override fun insertAuthCode(
        codeHash: String,
        userId: UUID,
        clientId: String,
        redirectUri: String,
        codeChallenge: String,
        expiresAt: Instant,
    ) {
        authCodes.save(
            AuthCodeEntity(
                codeHash = codeHash,
                userId = userId,
                clientId = clientId,
                redirectUri = redirectUri,
                codeChallenge = codeChallenge,
                expiresAt = expiresAt,
            ),
        )
    }

    @Transactional
    override fun takeAuthCode(codeHash: String, now: Instant): StoredAuthCode? =
        authCodes.takeAuthCode(codeHash, now)?.toStored()

    override fun insertRefresh(
        tokenHash: String,
        familyId: UUID,
        userId: UUID,
        clientId: String,
        expiresAt: Instant,
    ) {
        refreshTokens.save(
            RefreshTokenEntity(
                tokenHash = tokenHash,
                familyId = familyId,
                userId = userId,
                clientId = clientId,
                expiresAt = expiresAt,
            ),
        )
    }

    @Transactional
    override fun takeRefresh(tokenHash: String, now: Instant): StoredRefresh? {
        val unused = refreshTokens.takeRefresh(tokenHash, now)?.toUnused()
        if (unused != null) return unused
        return refreshTokens.peekReused(tokenHash, now)?.toReused()
    }

    @Transactional
    override fun revokeFamily(familyId: UUID) {
        refreshTokens.revokeFamily(familyId)
    }
}

private fun AuthCodeEntity.toStored(): StoredAuthCode? {
    val userId = userId ?: return null
    return StoredAuthCode(
        userId = userId,
        clientId = clientId,
        redirectUri = redirectUri,
        codeChallenge = codeChallenge,
    )
}

private fun RefreshTokenEntity.toUnused(): StoredRefresh? {
    val familyId = familyId ?: return null
    val userId = userId ?: return null
    return StoredRefresh(
        familyId = familyId,
        userId = userId,
        clientId = clientId,
        revoked = false,
    )
}

private fun RefreshTokenEntity.toReused(): StoredRefresh? {
    val familyId = familyId ?: return null
    val userId = userId ?: return null
    return StoredRefresh(
        familyId = familyId,
        userId = userId,
        clientId = clientId,
        revoked = true,
    )
}
