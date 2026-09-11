package fitnessapi.persist

import java.io.Serializable
import java.time.LocalDate
import java.util.UUID
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.IdClass
import jakarta.persistence.Table

data class DailyRollupId(
    var userId: UUID = UUID(0, 0),
    var metric: String = "",
    var day: LocalDate = LocalDate.EPOCH,
) : Serializable {
    companion object {
        private const val serialVersionUID: Long = 1
    }
}

@Entity
@Table(name = "daily_rollups")
@IdClass(DailyRollupId::class)
class DailyRollupEntity(
    @Id
    @Column(name = "user_id")
    var userId: UUID = UUID(0, 0),
    @Id
    var metric: String = "",
    @Id
    var day: LocalDate = LocalDate.EPOCH,
    @Column(name = "min_si")
    var minSi: Double? = null,
    @Column(name = "max_si")
    var maxSi: Double? = null,
    @Column(name = "avg_si")
    var avgSi: Double? = null,
    @Column(name = "sum_si")
    var sumSi: Double? = null,
    var n: Int = 0,
)
