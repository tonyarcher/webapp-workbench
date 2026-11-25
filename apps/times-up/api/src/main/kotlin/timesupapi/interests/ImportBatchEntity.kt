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
@Table(name = "import_batches")
class ImportBatchEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null,
    @Column(name = "user_id", nullable = false)
    var userId: UUID = UUID.randomUUID(),
    @Column(nullable = false, length = 64)
    var fingerprint: String = "",
    @Column(nullable = false, length = 16)
    var state: String = "running",
    @Column(nullable = false)
    var parsed: Int = 0,
    @Column(nullable = false)
    var resolved: Int = 0,
    @Column(nullable = false)
    var discovered: Int = 0,
    @Column(nullable = false)
    var failed: Int = 0,
    @Column(nullable = false)
    var pending: Int = 0,
    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now(),
)
