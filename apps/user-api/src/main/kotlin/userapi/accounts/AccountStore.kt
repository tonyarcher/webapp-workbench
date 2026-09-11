package userapi.accounts

import java.time.Instant
import java.util.UUID
import userapi.domain.LockoutState

data class StoredUser(
    val id: UUID,
    val username: String,
    val passwordHash: String,
    val failedLogins: Int,
    val lockedUntil: Instant?,
)

data class StoredSession(
    val userId: UUID,
    val username: String,
    val expiresAt: Instant,
)

interface AccountStore {
    fun createUser(username: String, passwordHash: String): UUID?
    fun findByUsername(username: String): StoredUser?
    fun findById(id: UUID): StoredUser?
    fun writeLockout(id: UUID, state: LockoutState)
    fun insertSession(userId: UUID, tokenHash: String, expiresAt: Instant)
    fun findSession(tokenHash: String, now: Instant): StoredSession?
    fun deleteSession(tokenHash: String)
}
