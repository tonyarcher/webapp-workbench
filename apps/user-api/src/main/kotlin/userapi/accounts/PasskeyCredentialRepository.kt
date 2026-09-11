package userapi.accounts

import com.yubico.webauthn.CredentialRepository
import com.yubico.webauthn.RegisteredCredential
import com.yubico.webauthn.data.ByteArray
import com.yubico.webauthn.data.PublicKeyCredentialDescriptor
import java.util.Optional

class PasskeyCredentialRepository(
    private val store: PasskeyStore,
) : CredentialRepository {
    override fun getCredentialIdsForUsername(username: String): Set<PublicKeyCredentialDescriptor> {
        return store.passkeysForUsername(username).map { row ->
            PublicKeyCredentialDescriptor.builder().id(ByteArray(row.credentialId)).build()
        }.toSet()
    }

    override fun getUserHandleForUsername(username: String): Optional<ByteArray> {
        val handle = store.handleForUsername(username) ?: return Optional.empty()
        return Optional.of(ByteArray(handle))
    }

    override fun getUsernameForUserHandle(userHandle: ByteArray): Optional<String> {
        return Optional.ofNullable(store.usernameForHandle(userHandle.bytes))
    }

    override fun lookup(credentialId: ByteArray, userHandle: ByteArray): Optional<RegisteredCredential> {
        val row = store.lookup(credentialId.bytes, userHandle.bytes) ?: return Optional.empty()
        return Optional.of(toRegistered(row))
    }

    override fun lookupAll(credentialId: ByteArray): Set<RegisteredCredential> {
        return store.lookupAll(credentialId.bytes).map { toRegistered(it) }.toSet()
    }
}

private fun toRegistered(row: StoredPasskey): RegisteredCredential =
    RegisteredCredential.builder()
        .credentialId(ByteArray(row.credentialId))
        .userHandle(ByteArray(row.userHandle))
        .publicKeyCose(ByteArray(row.publicKey))
        .signatureCount(row.signCount)
        .build()
