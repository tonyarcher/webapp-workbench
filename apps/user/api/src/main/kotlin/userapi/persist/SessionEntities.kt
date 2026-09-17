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
@Table(name = "sessions")
class SessionEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null,
    @Column(name = "user_id", nullable = false)
    var userId: UUID? = null,
    @Column(name = "token_hash", nullable = false, unique = true)
    var tokenHash: String = "",
    @Column(name = "expires_at", nullable = false)
    var expiresAt: Instant = Instant.now(),
    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),
)

@Entity
@Table(name = "login_challenges")
class LoginChallengeEntity(
    @Id
    @Column(name = "token_hash")
    var tokenHash: String = "",
    @Column(name = "user_id", nullable = false)
    var userId: UUID? = null,
    @Column(name = "expires_at", nullable = false)
    var expiresAt: Instant = Instant.now(),
)
