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
@Table(name = "resolution_cache")
class ResolutionCacheEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null,
    @Column(name = "label_key", nullable = false, unique = true, length = 255)
    var labelKey: String = "",
    @Column(length = 255)
    var host: String? = null,
    @Column(nullable = false, length = 32)
    var method: String = "google-news-rss",
    @Column(nullable = false)
    var confidence: Double = 0.0,
    @Column(name = "last_checked_at", nullable = false)
    var lastCheckedAt: Instant = Instant.now(),
    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),
)
