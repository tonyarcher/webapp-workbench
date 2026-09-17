package userapi.accounts

import java.time.Instant
import java.util.UUID
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.transaction.annotation.Transactional
import userapi.domain.LockoutState
import userapi.persist.SessionRepo
import userapi.persist.SessionEntity
import userapi.persist.UserEntity
import userapi.persist.UserRepo

open class JpaAccountStore(
    private val users: UserRepo,
    private val sessions: SessionRepo,
) : AccountStore {
    override fun createUser(username: String, passwordHash: String): UUID? {
        return try {
            users.save(UserEntity(username = username, passwordHash = passwordHash)).id
        } catch (_: DataIntegrityViolationException) {
            null
        }
    }

    override fun findByUsername(username: String): StoredUser? =
        users.findByUsername(username)?.toStored()

    override fun findById(id: UUID): StoredUser? =
        users.findById(id).orElse(null)?.toStored()

    @Transactional
    override fun writeLockout(id: UUID, state: LockoutState) {
        val user = users.findById(id).orElse(null) ?: return
        user.failedLogins = state.failedLogins
        user.lockedUntil = state.lockedUntil
    }

    override fun insertSession(userId: UUID, tokenHash: String, expiresAt: Instant) {
        sessions.save(SessionEntity(userId = userId, tokenHash = tokenHash, expiresAt = expiresAt))
    }

    override fun findSession(tokenHash: String, now: Instant): StoredSession? {
        val session = sessions.findByTokenHash(tokenHash) ?: return null
        if (!session.expiresAt.isAfter(now)) return null
        val user = users.findById(session.userId ?: return null).orElse(null) ?: return null
        return StoredSession(
            userId = user.id ?: return null,
            username = user.username,
            expiresAt = session.expiresAt,
            totpEnabled = user.totpSecret != null,
        )
    }

    @Transactional
    override fun deleteSession(tokenHash: String) {
        sessions.deleteByTokenHash(tokenHash)
    }
}

private fun UserEntity.toStored(): StoredUser? {
    val id = id ?: return null
    return StoredUser(
        id = id,
        username = username,
        passwordHash = passwordHash,
        failedLogins = failedLogins,
        lockedUntil = lockedUntil,
        totpEnabled = totpSecret != null,
    )
}
