package rssapi.persist

import java.time.Instant
import java.util.UUID
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "feed_sync")
class FeedSyncEntity(
    @Id
    @Column(name = "feed_id")
    var feedId: UUID = UUID(0, 0),
    var etag: String? = null,
    @Column(name = "last_modified")
    var lastModified: String? = null,
    @Column(name = "last_fetched_at")
    var lastFetchedAt: Instant? = null,
    @Column(name = "last_error")
    var lastError: String? = null,
)
