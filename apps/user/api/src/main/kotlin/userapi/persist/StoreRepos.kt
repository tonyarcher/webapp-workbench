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
    /**
     * Consume an auth code only if every caller-supplied field matches.
     *
     * The conditions are part of the DELETE, not a check after it. A code deleted
     * before it is validated cannot be retried, and a client whose first attempt
     * omits a field then finds the code gone on the corrected attempt.
     */
    @Query(
        value = """
            DELETE FROM oauth_auth_codes
            WHERE code_hash = :hash
              AND expires_at > :now
              AND client_id = :clientId
              AND redirect_uri = :redirectUri
              AND code_challenge = :codeChallenge
            RETURNING *
        """,
        nativeQuery = true,
    )
    fun takeAuthCode(
        hash: String,
        now: Instant,
        clientId: String,
        redirectUri: String,
        codeChallenge: String,
    ): AuthCodeEntity?
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

interface RateLimitRepo : JpaRepository<RateLimitBucketEntity, String> {
    /**
     * Count one attempt against [key] and return the count in the current window.
     *
     * One statement on purpose: a read-then-write would let two replicas
     * interleave and both see the same count, which is the bug this table
     * exists to remove. A window that has already elapsed restarts at 1, and
     * the comparison matches the in-memory rule this replaced
     * (`start <= now - window`), so the threshold does not drift.
     *
     * RETURNING the scalar, not the row. Mapping the row to the entity hands back
     * the already-managed instance when one is in the persistence context, so a
     * second call in the same transaction reads the *previous* count and the
     * limiter would allow everything. That only stayed hidden because each HTTP
     * request opens its own persistence context; a security threshold should not
     * depend on that.
     */
    @Query(
        value = """
            INSERT INTO rate_limit_buckets (bucket_key, window_started_at, hits)
            VALUES (:key, :now, 1)
            ON CONFLICT (bucket_key) DO UPDATE SET
                hits = CASE
                    WHEN rate_limit_buckets.window_started_at <= :cutoff THEN 1
                    ELSE rate_limit_buckets.hits + 1
                END,
                window_started_at = CASE
                    WHEN rate_limit_buckets.window_started_at <= :cutoff THEN :now
                    ELSE rate_limit_buckets.window_started_at
                END
            RETURNING hits
        """,
        nativeQuery = true,
    )
    fun recordHit(key: String, now: Instant, cutoff: Instant): Int

    /**
     * Drop buckets whose window closed, so the table cannot grow without bound.
     *
     * clearAutomatically matters here: a bulk delete bypasses the persistence
     * context, so without it a caller that had already loaded a bucket would keep
     * reading a row that no longer exists.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM RateLimitBucketEntity b WHERE b.windowStartedAt <= :cutoff")
    fun trimStaleWindows(cutoff: Instant): Int
}
