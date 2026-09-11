package userapi.http

import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import userapi.accounts.TotpStore
import userapi.domain.TotpEngine

class AcceptingTotp : TotpEngine {
    override fun newSecret(): String = "TESTSECRETBASE32"
    override fun verify(secretBase32: String, code: String, now: Instant): Boolean = code == "123456"
    override fun otpauth(username: String, secretBase32: String): String =
        "otpauth://totp/Workbench:$username?secret=$secretBase32"
}

class FakeTotpStore : TotpStore {
    private val pending = ConcurrentHashMap<UUID, String>()
    private val enabled = ConcurrentHashMap<UUID, String>()
    private val backups = ConcurrentHashMap<UUID, MutableSet<String>>()
    private val challenges = ConcurrentHashMap<String, Pair<UUID, Instant>>()

    override fun setPendingSecret(userId: UUID, secret: String) {
        pending[userId] = secret
    }

    override fun pendingSecret(userId: UUID): String? = pending[userId]

    override fun enableSecret(userId: UUID, secret: String) {
        enabled[userId] = secret
        pending.remove(userId)
    }

    override fun enabledSecret(userId: UUID): String? = enabled[userId]

    override fun replaceBackupHashes(userId: UUID, hashes: List<String>) {
        backups[userId] = hashes.toMutableSet()
    }

    override fun consumeBackupHash(userId: UUID, codeHash: String): Boolean {
        return backups[userId]?.remove(codeHash) == true
    }

    override fun insertChallenge(userId: UUID, tokenHash: String, expiresAt: Instant) {
        challenges[tokenHash] = userId to expiresAt
    }

    override fun findChallenge(tokenHash: String, now: Instant): UUID? {
        val pair = challenges[tokenHash] ?: return null
        if (!pair.second.isAfter(now)) return null
        return pair.first
    }

    override fun deleteChallenge(tokenHash: String) {
        challenges.remove(tokenHash)
    }
}
