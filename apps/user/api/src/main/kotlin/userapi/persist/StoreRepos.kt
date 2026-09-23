package userapi.persist

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import java.time.Instant
import java.util.UUID

interface PasskeyRepo : JpaRepository<PasskeyEntity, ByteArray> {
    fun findByUserId(userId: UUID): List<PasskeyEntity>
    fun findByCredentialIdAndUserHandle(credentialId: ByteArray, userHandle: ByteArray): PasskeyEntity?
    fun findByCredentialId(credentialId: ByteArray): List<PasskeyEntity>
    fun countByUserId(userId: UUID): Int
}

interface WebauthnChallengeRepo : JpaRepository<WebauthnChallengeEntity, String> {
    @Query(
        value = "DELETE FROM webauthn_challenges WHERE id = :id AND expires_at > :now RETURNING *",
        nativeQuery = true,
    )
    fun takeChallenge(id: String, now: Instant): WebauthnChallengeEntity?
}

interface SigningKeyRepo : JpaRepository<SigningKeyEntity, String> {
    fun findFirstByOrderByCreatedAtDesc(): SigningKeyEntity?
}

interface AuthCodeRepo : JpaRepository<AuthCodeEntity, String> {
    @Query(
        value = "DELETE FROM oauth_auth_codes WHERE code_hash = :hash AND expires_at > :now RETURNING *",
        nativeQuery = true,
    )
    fun takeAuthCode(hash: String, now: Instant): AuthCodeEntity?
}

interface RefreshTokenRepo : JpaRepository<RefreshTokenEntity, String> {
    @Query(
        value = "UPDATE oauth_refresh_tokens SET revoked = true " +
            "WHERE token_hash = :hash AND expires_at > :now AND revoked = false RETURNING *",
        nativeQuery = true,
    )
    fun takeRefresh(hash: String, now: Instant): RefreshTokenEntity?

    @Query(
        "SELECT r FROM RefreshTokenEntity r WHERE r.tokenHash = :hash AND r.revoked = true AND r.expiresAt > :now",
    )
    fun peekReused(hash: String, now: Instant): RefreshTokenEntity?

    @Modifying
    @Query("UPDATE RefreshTokenEntity r SET r.revoked = true WHERE r.familyId = :familyId")
    fun revokeFamily(familyId: UUID): Int
}

interface OAuthClientRepo : JpaRepository<OAuthClientEntity, String>

interface RedirectUriRepo : JpaRepository<RedirectUriEntity, RedirectUriId> {
    fun findByClientId(clientId: String): List<RedirectUriEntity>
}
