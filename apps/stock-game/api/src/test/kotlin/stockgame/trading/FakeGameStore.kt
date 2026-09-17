package stockgame.trading

import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong
import stockgame.domain.GameConfig
import stockgame.domain.Order
import stockgame.domain.Trade
import stockgame.store.GameStore
import stockgame.store.NewOrder
import stockgame.store.NewTrade

class FakeGameStore : GameStore {
    private val tradeSeq = AtomicLong(1)
    private val orderSeq = AtomicLong(1)
    private val configs = ConcurrentHashMap<UUID, GameConfig>()
    private val trades = ConcurrentHashMap<UUID, ConcurrentHashMap<Long, Trade>>()
    private val orders = ConcurrentHashMap<UUID, ConcurrentHashMap<Long, Order>>()

    private fun tradesOf(userId: UUID): ConcurrentHashMap<Long, Trade> =
        trades.computeIfAbsent(userId) { ConcurrentHashMap() }

    private fun ordersOf(userId: UUID): ConcurrentHashMap<Long, Order> =
        orders.computeIfAbsent(userId) { ConcurrentHashMap() }

    override fun getConfig(userId: UUID): GameConfig? = configs[userId]

    override fun saveConfig(userId: UUID, config: GameConfig) {
        configs[userId] = config
    }

    override fun listTrades(userId: UUID): List<Trade> =
        (trades[userId] ?: emptyMap()).values.sortedWith(compareBy({ it.executedAt }, { it.id }))

    override fun insertTrade(trade: NewTrade): Trade {
        val id = tradeSeq.getAndIncrement()
        val row = toTrade(id, trade)
        tradesOf(trade.userId)[id] = row
        return row
    }

    override fun listOrders(userId: UUID): List<Order> =
        (orders[userId] ?: emptyMap()).values.sortedWith(compareBy({ it.executeAt }, { it.id }))

    override fun insertOrder(order: NewOrder): Order {
        val id = orderSeq.getAndIncrement()
        val row = toOrder(id, order)
        ordersOf(order.userId)[id] = row
        return row
    }

    override fun pendingOrders(userId: UUID, now: Long): List<Order> =
        listOrders(userId).filter { it.status == "pending" && it.executeAt <= now }

    @Synchronized
    override fun fillOrderWithTrade(userId: UUID, orderId: Long, trade: NewTrade): Trade? {
        val rows = ordersOf(userId)
        val order = rows[orderId] ?: return null
        if (order.status != "pending") return null
        val saved = insertTrade(trade.copy(userId = userId))
        rows[orderId] = order.copy(status = "filled", tradeId = saved.id)
        return saved
    }

    override fun cancelOrder(userId: UUID, orderId: Long) {
        val rows = ordersOf(userId)
        val order = rows[orderId] ?: return
        if (order.status != "pending") return
        rows[orderId] = order.copy(status = "cancelled")
    }

    override fun userIdsWithPendingOrders(): List<UUID> =
        orders.entries
            .filter { (_, rows) -> rows.values.any { it.status == "pending" } }
            .map { (userId, _) -> userId }
}

private fun toTrade(id: Long, trade: NewTrade): Trade = Trade(
    id,
    trade.symbol,
    trade.side,
    trade.qty,
    trade.price,
    trade.cashDeltaCents,
    trade.mode,
    trade.executedAt,
    trade.createdAt,
)

private fun toOrder(id: Long, order: NewOrder): Order = Order(
    id,
    order.symbol,
    order.side,
    order.qty,
    order.executeAt,
    "pending",
    order.createdAt,
    null,
    order.orderType,
    order.tif,
    order.limitPrice,
    order.stopPrice,
    order.expiresAt,
    order.fillPriceSource,
)
