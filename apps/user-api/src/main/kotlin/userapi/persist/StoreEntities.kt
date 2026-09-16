package userapi.persist

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.IdClass
import jakarta.persistence.Table
import java.io.Serializable
import java.time.Instant
import java.util.UUID

data class BackupCodeId(var userId: UUID = UUID(0, 0), var codeHash: String = "") : Serializable {
    companion object {
        private const val serialVersionUID: Long = 1
    }
}

@Entity
@Table(name = "backup_codes")
@IdClass(BackupCodeId::class)
class BackupCodeEntity(
    @Id
    @Column(name = "user_id")
    var userId: UUID = UUID(0, 0),
    @Id
    @Column(name = "code_hash")
    var codeHash: String = "",
)

@Entity
@Table(name = "passkeys")
class PasskeyEntity(
    @Id
    @Column(name = "credential_id")
    var credentialId: ByteArray = ByteArray(0),
    @Column(name = "user_id", nullable = false)
    var userId: UUID? = null,
    @Column(name = "user_handle", nullable = false)
    var userHandle: ByteArray = ByteArray(0),
    @Column(name = "public_key", nullable = false)
    var publicKey: ByteArray = ByteArray(0),
    @Column(name = "sign_count", nullable = false)
    var signCount: Long = 0,
    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),
)

@Entity
@Table(name = "webauthn_challenges")
class WebauthnChallengeEntity(
    @Id
    var id: String = "",
    @Column(nullable = false)
    var kind: String = "",
    @Column(name = "user_id")
    var userId: UUID? = null,
    @Column(nullable = false)
    var payload: String = "",
    @Column(name = "expires_at", nullable = false)
    var expiresAt: Instant = Instant.now(),
)

@Entity
@Table(name = "oauth_signing_keys")
class SigningKeyEntity(
    @Id
    var kid: String = "",
    @Column(nullable = false)
    var jwk: String = "",
    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),
)

@Entity
@Table(name = "oauth_auth_codes")
class AuthCodeEntity(
    @Id
    @Column(name = "code_hash")
    var codeHash: String = "",
    @Column(name = "user_id", nullable = false)
    var userId: UUID? = null,
    @Column(name = "client_id", nullable = false)
    var clientId: String = "",
    @Column(name = "redirect_uri", nullable = false)
    var redirectUri: String = "",
    @Column(name = "code_challenge", nullable = false)
    var codeChallenge: String = "",
    @Column(name = "expires_at", nullable = false)
    var expiresAt: Instant = Instant.now(),
)

@Entity
@Table(name = "oauth_refresh_tokens")
class RefreshTokenEntity(
    @Id
    @Column(name = "token_hash")
    var tokenHash: String = "",
    @Column(name = "family_id", nullable = false)
    var familyId: UUID? = null,
    @Column(name = "user_id", nullable = false)
    var userId: UUID? = null,
    @Column(name = "client_id", nullable = false)
    var clientId: String = "",
    @Column(name = "expires_at", nullable = false)
    var expiresAt: Instant = Instant.now(),
    @Column(nullable = false)
    var revoked: Boolean = false,
)

@Entity
@Table(name = "oauth_clients")
class OAuthClientEntity(
    @Id
    @Column(name = "client_id")
    var clientId: String = "",
    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),
)

data class RedirectUriId(var clientId: String = "", var redirectUri: String = "") : Serializable {
    companion object {
        private const val serialVersionUID: Long = 1
    }
}

@Entity
@Table(name = "oauth_redirect_uris")
@IdClass(RedirectUriId::class)
class RedirectUriEntity(
    @Id
    @Column(name = "client_id")
    var clientId: String = "",
    @Id
    @Column(name = "redirect_uri")
    var redirectUri: String = "",
)
