package rssapi.persist

import java.time.Instant
import java.util.UUID
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "pending_article_state")
class PendingStateEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(name = "user_id", nullable = false)
    var userId: UUID = UUID(0, 0),
    @Column(name = "feed_id", nullable = false)
    var feedId: UUID = UUID(0, 0),
    var guid: String? = null,
    @Column(name = "norm_link")
    var normLink: String? = null,
    var link: String? = null,
    var read: Boolean = false,
    @Column(name = "read_at")
    var readAt: Instant? = null,
    var starred: Boolean = false,
    @Column(name = "created_at")
    var createdAt: Instant = Instant.now(),
)
