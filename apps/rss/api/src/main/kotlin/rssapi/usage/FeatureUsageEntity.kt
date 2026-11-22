package rssapi.usage
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.IdClass
import jakarta.persistence.Table
import java.io.Serializable
import java.time.LocalDate

data class FeatureUsageId(var feature: String = "", var day: LocalDate = LocalDate.EPOCH) : Serializable {
    companion object {
        private const val serialVersionUID: Long = 1
    }
}

@Entity
@Table(name = "feature_usage")
@IdClass(FeatureUsageId::class)
class FeatureUsageEntity(
    @Id
    var feature: String = "",
    @Id
    var day: LocalDate = LocalDate.EPOCH,
    @Column(nullable = false)
    var count: Long = 0,
)
