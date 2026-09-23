package userapi.accounts

import org.springframework.transaction.annotation.Transactional
import userapi.persist.BackupCodeEntity
import userapi.persist.BackupCodeRepo
import userapi.persist.LoginChallengeEntity
import userapi.persist.LoginChallengeRepo
import userapi.persist.UserRepo
import java.time.Instant
import java.util.UUID

open class JpaTotpStore(
    private val users: UserRepo,
    private val challenges: LoginChallengeRepo,
    private val backups: BackupCodeRepo,
) : TotpStore {
    @Transactional
    override fun setPendingSecret(userId: UUID, secret: String) {
        users.findById(userId).orElse(null)?.totpPending = secret
    }

    override fun pendingSecret(userId: UUID): String? = users.findById(userId).orElse(null)?.totpPending

    @Transactional
    override fun enableSecret(userId: UUID, secret: String) {
        val user = users.findById(userId).orElse(null) ?: return
        user.totpSecret = secret
        user.totpPending = null
    }

    override fun enabledSecret(userId: UUID): String? = users.findById(userId).orElse(null)?.totpSecret

    @Transactional
    override fun replaceBackupHashes(userId: UUID, hashes: List<String>) {
        backups.deleteByUserId(userId)
        backups.saveAll(hashes.map { BackupCodeEntity(userId = userId, codeHash = it) })
    }

    @Transactional
    override fun consumeBackupHash(userId: UUID, codeHash: String): Boolean = backups.consume(userId, codeHash) == 1

    override fun insertChallenge(userId: UUID, tokenHash: String, expiresAt: Instant) {
        challenges.save(LoginChallengeEntity(tokenHash = tokenHash, userId = userId, expiresAt = expiresAt))
    }

    @Transactional
    override fun findChallenge(tokenHash: String, now: Instant): UUID? = challenges.findValid(tokenHash, now)?.userId

    @Transactional
    override fun deleteChallenge(tokenHash: String) {
        challenges.deleteById(tokenHash)
    }
}
