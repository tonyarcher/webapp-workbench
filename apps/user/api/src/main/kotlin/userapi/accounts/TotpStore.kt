package userapi.accounts

import java.time.Instant
import java.util.UUID

interface TotpStore {
    fun setPendingSecret(userId: UUID, secret: String)
    fun pendingSecret(userId: UUID): String?
    fun enableSecret(userId: UUID, secret: String)
    fun enabledSecret(userId: UUID): String?
    fun replaceBackupHashes(userId: UUID, hashes: List<String>)
    fun consumeBackupHash(userId: UUID, codeHash: String): Boolean
    fun insertChallenge(userId: UUID, tokenHash: String, expiresAt: Instant)
    fun findChallenge(tokenHash: String, now: Instant): UUID?
    fun deleteChallenge(tokenHash: String)
}
