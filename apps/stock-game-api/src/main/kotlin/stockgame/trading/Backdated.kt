package stockgame.trading

import java.time.Instant
import java.util.UUID
import stockgame.domain.Bar
import stockgame.domain.GameConfig
import stockgame.domain.Trade
import stockgame.domain.TradingError
import stockgame.domain.applyCommission
import stockgame.domain.cashDelta
import stockgame.domain.fillPriceForBar
import stockgame.domain.round2
import stockgame.provider.PriceProvider
import stockgame.store.GameStore
import stockgame.store.NewTrade

private const val DAY_MS = 24 * 60 * 60 * 1000L

fun placeBackdated(
    store: GameStore,
    provider: PriceProvider,
    defaultProvider: String,
    userId: UUID,
    req: BackdatedRequest,
    now: Long,
): Trade {
    val config = loadConfig(store, userId, defaultProvider)
    if (req.at < config.startDate) {
        val start = Instant.ofEpochMilli(config.startDate)
        throw TradingError("Backdated trades before the game start date ($start) are not allowed")
    }
    val bar = findBar(provider, req.symbol, req.at)
    val price = fillPrice(bar, req)
    validateSide(config, store.listTrades(userId), req, price, bar.time)
    val delta = applyCommission(cashDelta(req.side, req.qty, price), config.commissionCentsPerTrade)
    return store.insertTrade(
        NewTrade(userId, req.symbol, req.side, req.qty, price, delta, "backdated", bar.time, now),
    )
}

data class BackdatedRequest(
    val symbol: String,
    val side: String,
    val qty: Int,
    val at: Long,
    val orderType: String,
    val limitPrice: Double?,
    val stopPrice: Double?,
)

private fun fillPrice(bar: Bar, req: BackdatedRequest): Double {
    val maybe = fillPriceForBar(bar, req.side, req.orderType, req.limitPrice, req.stopPrice)
        ?: throw TradingError("Order did not fill")
    return round2(maybe)
}

private fun findBar(provider: PriceProvider, symbol: String, at: Long): Bar {
    val bars = provider.getBars(symbol, "1d", at - 10 * DAY_MS, at + 45 * DAY_MS)
    return bars.filter { it.time >= at }.minByOrNull { it.time }
        ?: throw TradingError("No trading day found on or after ${Instant.ofEpochMilli(at)} for $symbol")
}

private fun validateSide(config: GameConfig, trades: List<Trade>, req: BackdatedRequest, price: Double, at: Long) {
    val delta = applyCommission(cashDelta(req.side, req.qty, price), config.commissionCentsPerTrade)
    if (req.side == "buy") requireBuyCash(config, trades, at, delta)
    else if (req.side == "sell") requireSellShares(trades, req.symbol, at, req.qty)
    else if (req.side == "cover") requireCover(config, trades, req.symbol, at, req.qty, delta)
}
