package stockgame.trading

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
    private var config: GameConfig? = null
    private val trades = ConcurrentHashMap<Long, Trade>()
    private val orders = ConcurrentHashMap<Long, Order>()

    override fun getConfig(): GameConfig? = config

    override fun saveConfig(config: GameConfig) {
        this.config = config
    }

    override fun listTrades(): List<Trade> = trades.values.sortedWith(compareBy({ it.executedAt }, { it.id }))

    override fun insertTrade(trade: NewTrade): Trade {
        val id = tradeSeq.getAndIncrement()
        val row = toTrade(id, trade)
        trades[id] = row
        return row
    }

    override fun listOrders(): List<Order> = orders.values.sortedWith(compareBy({ it.executeAt }, { it.id }))

    override fun insertOrder(order: NewOrder): Order {
        val id = orderSeq.getAndIncrement()
        val row = toOrder(id, order)
        orders[id] = row
        return row
    }

    override fun pendingOrders(now: Long): List<Order> =
        listOrders().filter { it.status == "pending" && it.executeAt <= now }

    @Synchronized
    override fun fillOrderWithTrade(orderId: Long, trade: NewTrade): Trade? {
        val order = orders[orderId] ?: return null
        if (order.status != "pending") return null
        val saved = insertTrade(trade)
        orders[orderId] = order.copy(status = "filled", tradeId = saved.id)
        return saved
    }

    override fun cancelOrder(orderId: Long) {
        val order = orders[orderId] ?: return
        if (order.status != "pending") return
        orders[orderId] = order.copy(status = "cancelled")
    }
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
