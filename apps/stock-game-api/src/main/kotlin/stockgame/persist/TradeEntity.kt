package stockgame.persist

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "trades")
class TradeEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    var symbol: String = "",
    var side: String = "",
    var qty: Int = 0,
    var price: Double = 0.0,
    @Column(name = "cash_delta_cents")
    var cashDeltaCents: Long = 0,
    var mode: String = "",
    @Column(name = "executed_at")
    var executedAt: Long = 0,
    @Column(name = "created_at")
    var createdAt: Long = 0,
)
