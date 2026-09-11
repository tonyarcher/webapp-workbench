package stockgame.persist

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "orders")
class OrderEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    var symbol: String = "",
    var side: String = "",
    var qty: Int = 0,
    @Column(name = "execute_at")
    var executeAt: Long = 0,
    var status: String = "pending",
    @Column(name = "created_at")
    var createdAt: Long = 0,
    @Column(name = "trade_id")
    var tradeId: Long? = null,
    @Column(name = "order_type")
    var orderType: String = "market",
    var tif: String = "GTC",
    @Column(name = "limit_price")
    var limitPrice: Double? = null,
    @Column(name = "stop_price")
    var stopPrice: Double? = null,
    @Column(name = "expires_at")
    var expiresAt: Long? = null,
    @Column(name = "fill_price_source")
    var fillPriceSource: String = "last",
)
