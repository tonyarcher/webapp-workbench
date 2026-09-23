package rssapi.persist

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

const val EDITION_BUILDING: String = "building"
const val EDITION_READY: String = "ready"
const val EDITION_FAILED: String = "failed"

@Entity
@Table(name = "editions")
class EditionEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null,
    @Column(name = "window_start", nullable = false)
    var windowStart: Instant = Instant.now(),
    @Column(name = "window_end", nullable = false)
    var windowEnd: Instant = Instant.now(),
    @Column(nullable = false)
    var status: String = EDITION_BUILDING,
    @Column(columnDefinition = "TEXT")
    var body: String? = null,
    @Column
    var model: String? = null,
    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),
    @Column(name = "user_id")
    var userId: UUID? = null,
)
