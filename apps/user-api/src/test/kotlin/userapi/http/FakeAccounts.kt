package userapi.http

import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import userapi.accounts.AccountStore
import userapi.accounts.StoredSession
import userapi.accounts.StoredUser
import userapi.domain.LockoutState
import userapi.domain.PasswordHasher

class PlainHasher : PasswordHasher {
    override fun hash(password: String): String = "plain:$password"
    override fun verify(password: String, passwordHash: String): Boolean =
        passwordHash == "plain:$password"
}

class FakeAccountStore : AccountStore {
    private val users = ConcurrentHashMap<UUID, StoredUser>()
    private val byName = ConcurrentHashMap<String, UUID>()
    private val sessions = ConcurrentHashMap<String, Pair<UUID, Instant>>()

    override fun createUser(username: String, passwordHash: String): UUID? {
        if (byName.containsKey(username)) return null
        val id = UUID.randomUUID()
        users[id] = StoredUser(id, username, passwordHash, 0, null)
        byName[username] = id
        return id
    }

    override fun findByUsername(username: String): StoredUser? {
        val id = byName[username] ?: return null
        return users[id]
    }

    override fun findById(id: UUID): StoredUser? = users[id]

    override fun writeLockout(id: UUID, state: LockoutState) {
        val user = users[id] ?: return
        users[id] = user.copy(failedLogins = state.failedLogins, lockedUntil = state.lockedUntil)
    }

    override fun insertSession(userId: UUID, tokenHash: String, expiresAt: Instant) {
        sessions[tokenHash] = userId to expiresAt
    }

    override fun findSession(tokenHash: String, now: Instant): StoredSession? {
        val pair = sessions[tokenHash] ?: return null
        if (!pair.second.isAfter(now)) return null
        val user = users[pair.first] ?: return null
        return StoredSession(user.id, user.username, pair.second, user.totpEnabled)
    }

    override fun deleteSession(tokenHash: String) {
        sessions.remove(tokenHash)
    }

    fun setTotpEnabled(id: UUID, enabled: Boolean) {
        val user = users[id] ?: return
        users[id] = user.copy(totpEnabled = enabled)
    }
}
