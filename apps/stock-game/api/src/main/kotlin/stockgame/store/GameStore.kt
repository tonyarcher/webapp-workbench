package stockgame.store

import java.util.UUID
import stockgame.domain.GameConfig
import stockgame.domain.Order
import stockgame.domain.Trade

data class NewTrade(
    val userId: UUID,
    val symbol: String,
    val side: String,
    val qty: Int,
    val price: Double,
    val cashDeltaCents: Long,
    val mode: String,
    val executedAt: Long,
    val createdAt: Long,
)

data class NewOrder(
    val userId: UUID,
    val symbol: String,
    val side: String,
    val qty: Int,
    val executeAt: Long,
    val createdAt: Long,
    val orderType: String,
    val tif: String,
    val limitPrice: Double?,
    val stopPrice: Double?,
    val expiresAt: Long?,
    val fillPriceSource: String,
)

interface GameStore {
    fun getConfig(userId: UUID): GameConfig?
    fun saveConfig(userId: UUID, config: GameConfig)
    fun listTrades(userId: UUID): List<Trade>
    fun insertTrade(trade: NewTrade): Trade
    fun listOrders(userId: UUID): List<Order>
    fun insertOrder(order: NewOrder): Order
    fun pendingOrders(userId: UUID, now: Long): List<Order>
    fun fillOrderWithTrade(userId: UUID, orderId: Long, trade: NewTrade): Trade?
    fun cancelOrder(userId: UUID, orderId: Long)
    fun userIdsWithPendingOrders(): List<UUID>
}
