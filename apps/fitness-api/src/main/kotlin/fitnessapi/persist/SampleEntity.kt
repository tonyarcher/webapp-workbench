package fitnessapi.persist

import java.time.Instant
import java.util.UUID
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint

@Entity
@Table(
    name = "samples",
    uniqueConstraints = [
        UniqueConstraint(columnNames = ["user_id", "metric", "t", "source", "origin_id"]),
    ],
)
class SampleEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null,
    @Column(name = "user_id", nullable = false)
    var userId: UUID = UUID(0, 0),
    var metric: String = "",
    var t: Instant = Instant.EPOCH,
    @Column(name = "value_si", nullable = false)
    var valueSi: Double = 0.0,
    var source: String = "",
    @Column(name = "origin_id", nullable = false)
    var originId: String = "",
    var hidden: Boolean = false,
    var note: String? = null,
)
