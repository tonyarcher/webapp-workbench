package fitnessapi.persist

import java.time.Instant
import java.util.UUID
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes

@Entity
@Table(name = "imports")
class ImportEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null,
    @Column(name = "user_id", nullable = false)
    var userId: UUID = UUID(0, 0),
    var source: String = "",
    @Column(name = "started_at", nullable = false)
    var startedAt: Instant = Instant.now(),
    @Column(name = "finished_at")
    var finishedAt: Instant? = null,
    @Column(name = "row_count")
    var rowCount: Int? = null,
    @Column(name = "error_count")
    var errorCount: Int? = null,
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    var errors: String? = null,
)
