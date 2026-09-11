package stockgame.store

import stockgame.domain.GameConfig
import stockgame.domain.Order
import stockgame.domain.Trade

data class NewTrade(
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
    fun getConfig(): GameConfig?
    fun saveConfig(config: GameConfig)
    fun listTrades(): List<Trade>
    fun insertTrade(trade: NewTrade): Trade
    fun listOrders(): List<Order>
    fun insertOrder(order: NewOrder): Order
    fun pendingOrders(now: Long): List<Order>
    fun fillOrderWithTrade(orderId: Long, trade: NewTrade): Trade?
    fun cancelOrder(orderId: Long)
}
