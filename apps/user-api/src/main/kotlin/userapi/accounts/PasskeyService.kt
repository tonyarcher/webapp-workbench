package userapi.accounts

import com.yubico.webauthn.AssertionRequest
import com.yubico.webauthn.FinishAssertionOptions
import com.yubico.webauthn.FinishRegistrationOptions
import com.yubico.webauthn.RelyingParty
import com.yubico.webauthn.StartAssertionOptions
import com.yubico.webauthn.StartRegistrationOptions
import com.yubico.webauthn.data.AuthenticatorSelectionCriteria
import com.yubico.webauthn.data.PublicKeyCredential
import com.yubico.webauthn.data.PublicKeyCredentialCreationOptions
import com.yubico.webauthn.data.ResidentKeyRequirement
import com.yubico.webauthn.data.UserIdentity
import com.yubico.webauthn.data.UserVerificationRequirement
import java.time.Clock
import java.time.Duration
import java.util.UUID
import userapi.Settings
import userapi.domain.PENDING_MAX_AGE_SEC
import userapi.domain.newToken

const val CHALLENGE_REGISTER = "register"
const val CHALLENGE_LOGIN = "login"

class PasskeyService(
    val rp: RelyingParty,
    val store: PasskeyStore,
    val challenges: WebauthnChallengeStore,
    val clock: Clock,
) {
    fun startRegister(userId: UUID, username: String): Pair<String, String> {
        val handle = store.ensureUserHandle(userId)
        val user = UserIdentity.builder()
            .name(username)
            .displayName(username)
            .id(com.yubico.webauthn.data.ByteArray(handle))
            .build()
        val request = rp.startRegistration(registerOptions(user))
        return saveChallenge(CHALLENGE_REGISTER, userId, request.toJson(), request.toCredentialsCreateJson())
    }

    fun finishRegister(requestId: String, responseJson: String, userId: UUID) {
        val challenge = challenges.takeChallenge(requestId, clock.instant())
            ?: error("expired webauthn challenge")
        require(challenge.kind == CHALLENGE_REGISTER && challenge.userId == userId)
        val request = PublicKeyCredentialCreationOptions.fromJson(challenge.payload)
        val pkc = PublicKeyCredential.parseRegistrationResponseJson(responseJson)
        val result = rp.finishRegistration(
            FinishRegistrationOptions.builder().request(request).response(pkc).build(),
        )
        store.insertPasskey(toRow(userId, store.ensureUserHandle(userId), result))
    }

    fun startLogin(): Pair<String, String> {
        val request = rp.startAssertion(
            StartAssertionOptions.builder()
                .userVerification(UserVerificationRequirement.PREFERRED)
                .build(),
        )
        return saveChallenge(CHALLENGE_LOGIN, null, request.toJson(), request.toCredentialsGetJson())
    }

    fun finishLogin(requestId: String, responseJson: String): String {
        val challenge = challenges.takeChallenge(requestId, clock.instant())
            ?: error("expired webauthn challenge")
        require(challenge.kind == CHALLENGE_LOGIN)
        val request = AssertionRequest.fromJson(challenge.payload)
        val pkc = PublicKeyCredential.parseAssertionResponseJson(responseJson)
        val result = rp.finishAssertion(
            FinishAssertionOptions.builder().request(request).response(pkc).build(),
        )
        require(result.isSuccess)
        store.updateSignCount(result.credential.credentialId.bytes, result.signatureCount)
        return result.username
    }

    private fun saveChallenge(kind: String, userId: UUID?, payload: String, clientJson: String): Pair<String, String> {
        val id = newToken()
        val expires = clock.instant().plus(Duration.ofSeconds(PENDING_MAX_AGE_SEC.toLong()))
        challenges.putChallenge(WebauthnChallenge(id, kind, userId, payload), expires)
        return id to clientJson
    }
}

fun buildRelyingParty(settings: Settings, store: PasskeyStore): RelyingParty {
    val identity = com.yubico.webauthn.data.RelyingPartyIdentity.builder()
        .id(settings.rpId)
        .name("Workbench")
        .build()
    return RelyingParty.builder()
        .identity(identity)
        .credentialRepository(PasskeyCredentialRepository(store))
        .origins(settings.origins)
        .build()
}

private fun registerOptions(user: UserIdentity): StartRegistrationOptions =
    StartRegistrationOptions.builder()
        .user(user)
        .authenticatorSelection(
            AuthenticatorSelectionCriteria.builder()
                .residentKey(ResidentKeyRequirement.REQUIRED)
                .userVerification(UserVerificationRequirement.PREFERRED)
                .build(),
        )
        .build()

private fun toRow(userId: UUID, handle: ByteArray, result: com.yubico.webauthn.RegistrationResult): StoredPasskey =
    StoredPasskey(
        credentialId = result.keyId.id.bytes,
        userId = userId,
        userHandle = handle,
        publicKey = result.publicKeyCose.bytes,
        signCount = result.signatureCount,
    )
