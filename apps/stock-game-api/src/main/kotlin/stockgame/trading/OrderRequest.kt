package stockgame.trading

import java.util.UUID
import stockgame.domain.Order
import stockgame.domain.TradingError
import stockgame.domain.asapExecuteAt
import stockgame.domain.defaultFillPriceSource
import stockgame.domain.expiresAtForOrder
import stockgame.store.GameStore
import stockgame.store.NewOrder

data class OrderRequest(
    val symbol: String,
    val side: String,
    val qty: Int,
    val executeAt: Long?,
    val orderType: String,
    val tif: String,
    val limitPrice: Double?,
    val stopPrice: Double?,
    val fillPriceSource: String?,
)

fun placeScheduled(store: GameStore, defaultProvider: String, userId: UUID, req: OrderRequest, now: Long): Order {
    val config = loadConfig(store, userId, defaultProvider)
    val executeAt = resolveExecuteAt(req.executeAt, config.quoteDelayMinutes, now)
    val source = req.fillPriceSource ?: defaultFillPriceSource(req.side)
    val expires = if (req.tif == "DAY") expiresAtForOrder(executeAt) else null
    return store.insertOrder(
        NewOrder(
            symbol = req.symbol,
            side = req.side,
            qty = req.qty,
            executeAt = executeAt,
            createdAt = now,
            orderType = req.orderType,
            tif = req.tif,
            limitPrice = req.limitPrice,
            stopPrice = req.stopPrice,
            expiresAt = expires,
            fillPriceSource = source,
            userId = userId,
        ),
    )
}

private fun resolveExecuteAt(inputAt: Long?, delayMinutes: Int, now: Long): Long {
    if (inputAt == null) return asapExecuteAt(now, delayMinutes)
    if (inputAt <= now) throw TradingError("Scheduled execution time must be in the future")
    return inputAt
}
