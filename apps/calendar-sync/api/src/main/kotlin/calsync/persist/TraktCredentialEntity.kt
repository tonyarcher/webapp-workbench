package calsync.persist

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "trakt_credentials")
class TraktCredentialEntity(
    @Id
    @Column(name = "user_id")
    var userId: UUID? = null,
    @Column(name = "client_id")
    var clientId: String = "",
    @Column(name = "client_secret")
    var clientSecret: String = "",
    @Column(name = "access_token")
    var accessToken: String? = null,
    @Column(name = "refresh_token")
    var refreshToken: String? = null,
    @Column(name = "expires_at")
    var expiresAt: Instant? = null,
)
