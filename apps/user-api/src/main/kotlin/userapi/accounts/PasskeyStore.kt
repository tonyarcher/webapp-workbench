package userapi.accounts

import java.time.Instant
import java.util.UUID

data class StoredPasskey(
    val credentialId: ByteArray,
    val userId: UUID,
    val userHandle: ByteArray,
    val publicKey: ByteArray,
    val signCount: Long,
)

data class WebauthnChallenge(
    val id: String,
    val kind: String,
    val userId: UUID?,
    val payload: String,
)

interface PasskeyStore {
    fun ensureUserHandle(userId: UUID): ByteArray
    fun usernameForHandle(handle: ByteArray): String?
    fun handleForUsername(username: String): ByteArray?
    fun userIdForUsername(username: String): UUID?
    fun insertPasskey(row: StoredPasskey)
    fun updateSignCount(credentialId: ByteArray, signCount: Long)
    fun passkeysForUsername(username: String): List<StoredPasskey>
    fun lookup(credentialId: ByteArray, userHandle: ByteArray): StoredPasskey?
    fun lookupAll(credentialId: ByteArray): List<StoredPasskey>
    fun countForUser(userId: UUID): Int
}

interface WebauthnChallengeStore {
    fun putChallenge(row: WebauthnChallenge, expiresAt: Instant)
    fun takeChallenge(id: String, now: Instant): WebauthnChallenge?
}
