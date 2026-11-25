package timesupapi.interests

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

enum class InterestKind { TOPIC, ENTITY, PLACE, SOURCE }

@Entity
@Table(name = "interests")
class InterestEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null,
    @Column(name = "user_id", nullable = false)
    var userId: UUID = UUID.randomUUID(),
    @Column(nullable = false, length = 16)
    var kind: String = InterestKind.TOPIC.name,
    @Column(nullable = false, length = 255)
    var label: String = "",
    @Column(name = "key", nullable = false, length = 255)
    var key: String = "",
    @Column(nullable = false)
    var weight: Double = 1.0,
    @Column(nullable = false, length = 32)
    var origin: String = "import",
    @Column(name = "feed_id")
    var feedId: UUID? = null,
    @Column(nullable = false)
    var enabled: Boolean = true,
    @Column(name = "decay_half_life_days", nullable = false)
    var decayHalfLifeDays: Int = 30,
    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),
    @Column(name = "last_hit_at")
    var lastHitAt: Instant? = null,
)
