package stockgame.trading

import java.util.UUID
import stockgame.domain.Order
import stockgame.domain.applyCommission
import stockgame.domain.cashDelta
import stockgame.domain.isNyseOpen
import stockgame.domain.quoteFillPrice
import stockgame.domain.round2
import stockgame.domain.shouldFillQuote
import stockgame.provider.PriceProvider
import stockgame.store.GameStore
import stockgame.store.NewTrade

fun executeDue(
    store: GameStore,
    provider: PriceProvider,
    defaultProvider: String,
    userId: UUID,
    now: Long,
): Int {
    cancelExpired(store, userId, now)
    if (!isNyseOpen(now)) return 0
    var filled = 0
    for (order in store.pendingOrders(userId, now)) {
        if (isDue(order, now) && tryFill(store, provider, defaultProvider, userId, order, now)) filled += 1
    }
    return filled
}

private fun isDue(order: Order, now: Long): Boolean {
    if (order.status != "pending") return false
    return order.expiresAt == null || order.expiresAt > now
}

private fun cancelExpired(store: GameStore, userId: UUID, now: Long) {
    for (order in store.listOrders(userId)) {
        if (isExpiredDay(order, now)) store.cancelOrder(userId, order.id)
    }
}

private fun isExpiredDay(order: Order, now: Long): Boolean {
    if (order.status != "pending") return false
    if (order.tif != "DAY") return false
    return order.expiresAt != null && order.expiresAt <= now
}

private fun tryFill(
    store: GameStore,
    provider: PriceProvider,
    defaultProvider: String,
    userId: UUID,
    order: Order,
    now: Long,
): Boolean {
    val quote = runCatching { provider.getQuote(order.symbol) }.getOrNull() ?: return false
    val px = quoteFillPrice(quote, order.fillPriceSource)
    if (!shouldFillQuote(px, order.side, order.orderType, order.limitPrice, order.stopPrice)) return false
    return fillIfPossible(store, defaultProvider, userId, order, round2(px), now)
}

private fun fillIfPossible(
    store: GameStore,
    defaultProvider: String,
    userId: UUID,
    order: Order,
    price: Double,
    now: Long,
): Boolean {
    val config = loadConfig(store, userId, defaultProvider)
    val delta = applyCommission(cashDelta(order.side, order.qty, price), config.commissionCentsPerTrade)
    if (!isFillPossible(store, defaultProvider, userId, order, delta)) return false
    val trade = store.fillOrderWithTrade(
        userId,
        order.id,
        NewTrade(userId, order.symbol, order.side, order.qty, price, delta, "scheduled", now, now),
    )
    return trade != null
}

private fun isFillPossible(
    store: GameStore,
    defaultProvider: String,
    userId: UUID,
    order: Order,
    delta: Long,
): Boolean {
    val trades = store.listTrades(userId)
    val config = loadConfig(store, userId, defaultProvider)
    if (order.side == "buy") return cashUpTo(config, trades, Long.MAX_VALUE) + delta >= 0
    if (order.side == "sell") {
        if (maxOf(0, heldQty(trades, order.symbol)) < order.qty) {
            store.cancelOrder(userId, order.id)
            return false
        }
        return true
    }
    if (order.side == "cover") return coverPossible(store, config, userId, trades, order, delta)
    return true
}

private fun coverPossible(
    store: GameStore,
    config: stockgame.domain.GameConfig,
    userId: UUID,
    trades: List<stockgame.domain.Trade>,
    order: Order,
    delta: Long,
): Boolean {
    val shortQty = maxOf(0, -heldQty(trades, order.symbol))
    if (shortQty < order.qty) {
        store.cancelOrder(userId, order.id)
        return false
    }
    return cashUpTo(config, trades, Long.MAX_VALUE) + delta >= 0
}
