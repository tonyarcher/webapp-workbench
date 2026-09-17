package userapi.persist

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "users")
class UserEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null,
    @Column(nullable = false, unique = true)
    var username: String = "",
    @Column(name = "password_hash", nullable = false)
    var passwordHash: String = "",
    @Column(name = "failed_logins", nullable = false)
    var failedLogins: Int = 0,
    @Column(name = "locked_until")
    var lockedUntil: Instant? = null,
    @Column(name = "totp_secret")
    var totpSecret: String? = null,
    @Column(name = "totp_pending")
    var totpPending: String? = null,
    @Column(name = "webauthn_handle")
    var webauthnHandle: ByteArray? = null,
    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),
)
