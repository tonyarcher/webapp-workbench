package userapi.accounts

import org.springframework.transaction.annotation.Transactional
import userapi.persist.PasskeyEntity
import userapi.persist.PasskeyRepo
import userapi.persist.UserRepo
import java.security.SecureRandom
import java.util.UUID

open class JpaPasskeyStore(private val passkeys: PasskeyRepo, private val users: UserRepo) : PasskeyStore {
    private val random = SecureRandom()

    @Transactional
    override fun ensureUserHandle(userId: UUID): ByteArray {
        val existing = readHandle(users, userId)
        if (existing != null) return existing
        val handle = ByteArray(32).also { random.nextBytes(it) }
        writeHandle(users, userId, handle)
        return readHandle(users, userId) ?: handle
    }

    override fun usernameForHandle(handle: ByteArray): String? = users.findByWebauthnHandle(handle)?.username

    override fun handleForUsername(username: String): ByteArray? = users.findByUsername(username)?.webauthnHandle

    override fun userIdForUsername(username: String): UUID? = users.findByUsername(username)?.id

    override fun insertPasskey(row: StoredPasskey) {
        passkeys.save(
            PasskeyEntity(
                credentialId = row.credentialId,
                userId = row.userId,
                userHandle = row.userHandle,
                publicKey = row.publicKey,
                signCount = row.signCount,
            ),
        )
    }

    @Transactional
    override fun updateSignCount(credentialId: ByteArray, signCount: Long) {
        passkeys.findByCredentialId(credentialId).forEach { it.signCount = signCount }
    }

    override fun passkeysForUsername(username: String): List<StoredPasskey> {
        val userId = users.findByUsername(username)?.id ?: return emptyList()
        return passkeys.findByUserId(userId).map { it.toStored() }
    }

    override fun lookup(credentialId: ByteArray, userHandle: ByteArray): StoredPasskey? =
        passkeys.findByCredentialIdAndUserHandle(credentialId, userHandle)?.toStored()

    override fun lookupAll(credentialId: ByteArray): List<StoredPasskey> =
        passkeys.findByCredentialId(credentialId).map { it.toStored() }

    override fun countForUser(userId: UUID): Int = passkeys.countByUserId(userId)
}

private fun readHandle(users: UserRepo, userId: UUID): ByteArray? = users.findById(userId).orElse(null)?.webauthnHandle

private fun writeHandle(users: UserRepo, userId: UUID, handle: ByteArray) {
    val user = users.findById(userId).orElse(null) ?: return
    user.webauthnHandle = handle
}

private fun PasskeyEntity.toStored(): StoredPasskey = StoredPasskey(
    credentialId = credentialId,
    userId = userId ?: UUID(0, 0),
    userHandle = userHandle,
    publicKey = publicKey,
    signCount = signCount,
)
