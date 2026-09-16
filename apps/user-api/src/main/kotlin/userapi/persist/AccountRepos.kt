package userapi.persist

import java.time.Instant
import java.util.UUID
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query

interface UserRepo : JpaRepository<UserEntity, UUID> {
    fun findByUsername(username: String): UserEntity?
    fun findByWebauthnHandle(handle: ByteArray): UserEntity?
}

interface SessionRepo : JpaRepository<SessionEntity, UUID> {
    fun findByTokenHash(tokenHash: String): SessionEntity?
    fun deleteByTokenHash(tokenHash: String): Long
}

interface LoginChallengeRepo : JpaRepository<LoginChallengeEntity, String> {
    @Query(
        "SELECT c FROM LoginChallengeEntity c WHERE c.tokenHash = :hash AND c.expiresAt > :now",
    )
    fun findValid(hash: String, now: Instant): LoginChallengeEntity?
}

interface BackupCodeRepo : JpaRepository<BackupCodeEntity, BackupCodeId> {
    @Modifying
    @Query("DELETE FROM BackupCodeEntity b WHERE b.userId = :userId")
    fun deleteByUserId(userId: UUID): Int

    @Modifying
    @Query("DELETE FROM BackupCodeEntity b WHERE b.userId = :userId AND b.codeHash = :hash")
    fun consume(userId: UUID, hash: String): Int
}
