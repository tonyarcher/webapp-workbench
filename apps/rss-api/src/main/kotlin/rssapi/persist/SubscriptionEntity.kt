package rssapi.persist

import java.io.Serializable
import java.time.Instant
import java.util.UUID
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.IdClass
import jakarta.persistence.Table

data class SubscriptionId(
    var userId: UUID = UUID(0, 0),
    var feedId: UUID = UUID(0, 0),
) : Serializable {
    companion object {
        private const val serialVersionUID: Long = 1
    }
}

@Entity
@Table(name = "subscriptions")
@IdClass(SubscriptionId::class)
class SubscriptionEntity(
    @Id
    @Column(name = "user_id")
    var userId: UUID = UUID(0, 0),
    @Id
    @Column(name = "feed_id")
    var feedId: UUID = UUID(0, 0),
    @Column(name = "added_at")
    var addedAt: Instant = Instant.now(),
)
