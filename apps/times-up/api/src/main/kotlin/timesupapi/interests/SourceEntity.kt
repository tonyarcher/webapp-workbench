package timesupapi.interests

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "sources")
class SourceEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null,
    @Column(name = "user_id", nullable = false)
    var userId: UUID = UUID.randomUUID(),
    @Column(nullable = false, length = 255)
    var label: String = "",
    @Column(nullable = false, length = 255)
    var key: String = "",
    @Column(length = 255)
    var host: String? = null,
    @Column(name = "feed_id")
    var feedId: UUID? = null,
    @Column(nullable = false)
    var resolved: Boolean = false,
    @Column(nullable = false)
    var validated: Boolean = false,
    @Column(nullable = false)
    var confidence: Double = 0.0,
    @Column(name = "last_checked_at")
    var lastCheckedAt: Instant? = null,
    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),
)
