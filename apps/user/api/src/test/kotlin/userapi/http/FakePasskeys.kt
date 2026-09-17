package userapi.http

import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import userapi.accounts.PasskeyStore
import userapi.accounts.StoredPasskey
import userapi.accounts.WebauthnChallenge
import userapi.accounts.WebauthnChallengeStore

class FakePasskeyStore : PasskeyStore {
    private val handles = ConcurrentHashMap<UUID, ByteArray>()
    private val names = ConcurrentHashMap<UUID, String>()
    private val rows = ConcurrentHashMap<String, StoredPasskey>()

    fun bindUsername(userId: UUID, username: String) {
        names[userId] = username
    }

    override fun ensureUserHandle(userId: UUID): ByteArray =
        handles.getOrPut(userId) { ByteArray(32) { 1 } }

    override fun usernameForHandle(handle: ByteArray): String? {
        val id = handles.entries.find { it.value.contentEquals(handle) }?.key ?: return null
        return names[id]
    }

    override fun handleForUsername(username: String): ByteArray? {
        val id = names.entries.find { it.value == username }?.key ?: return null
        return handles[id]
    }

    override fun userIdForUsername(username: String): UUID? =
        names.entries.find { it.value == username }?.key

    override fun insertPasskey(row: StoredPasskey) {
        rows[row.credentialId.contentToString()] = row
    }

    override fun updateSignCount(credentialId: ByteArray, signCount: Long) {
        val key = credentialId.contentToString()
        val row = rows[key] ?: return
        rows[key] = row.copy(signCount = signCount)
    }

    override fun passkeysForUsername(username: String): List<StoredPasskey> {
        val id = userIdForUsername(username) ?: return emptyList()
        return rows.values.filter { it.userId == id }
    }

    override fun lookup(credentialId: ByteArray, userHandle: ByteArray): StoredPasskey? {
        val row = rows[credentialId.contentToString()] ?: return null
        return if (row.userHandle.contentEquals(userHandle)) row else null
    }

    override fun lookupAll(credentialId: ByteArray): List<StoredPasskey> {
        val row = rows[credentialId.contentToString()] ?: return emptyList()
        return listOf(row)
    }

    override fun countForUser(userId: UUID): Int = rows.values.count { it.userId == userId }
}

class FakeChallengeStore : WebauthnChallengeStore {
    private val rows = ConcurrentHashMap<String, Pair<WebauthnChallenge, Instant>>()

    override fun putChallenge(row: WebauthnChallenge, expiresAt: Instant) {
        rows[row.id] = row to expiresAt
    }

    override fun takeChallenge(id: String, now: Instant): WebauthnChallenge? {
        val pair = rows.remove(id) ?: return null
        return if (pair.second.isAfter(now)) pair.first else null
    }
}
