package stockgame.persist

import java.io.Serializable
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.IdClass
import jakarta.persistence.Table

data class PriceCacheId(
    var symbol: String = "",
    var interval: String = "",
    var date: Long = 0,
) : Serializable {
    companion object {
        private const val serialVersionUID: Long = 1
    }
}

@Entity
@Table(name = "price_cache")
@IdClass(PriceCacheId::class)
class PriceCacheEntity(
    @Id
    var symbol: String = "",
    @Id
    var interval: String = "",
    @Id
    var date: Long = 0,
    var open: Double = 0.0,
    var high: Double = 0.0,
    var low: Double = 0.0,
    var close: Double = 0.0,
    var volume: Long = 0,
)
