package stockgame.trading

import stockgame.domain.GameConfig
import stockgame.domain.Trade
import stockgame.domain.TradingError
import stockgame.domain.signedQty

fun cashUpTo(config: GameConfig, trades: List<Trade>, at: Long): Long {
    var cash = config.startingCashCents
    for (trade in trades) {
        if (trade.executedAt > at) continue
        cash += trade.cashDeltaCents
    }
    return cash
}

fun heldQtyUpTo(trades: List<Trade>, symbol: String, at: Long): Int {
    var qty = 0
    for (trade in trades) {
        if (trade.symbol != symbol || trade.executedAt > at) continue
        qty += signedQty(trade.side, trade.qty)
    }
    return qty
}

fun heldQty(trades: List<Trade>, symbol: String): Int = heldQtyUpTo(trades, symbol, Long.MAX_VALUE)

fun requireBuyCash(config: GameConfig, trades: List<Trade>, at: Long, delta: Long) {
    if (cashUpTo(config, trades, at) + delta < 0) {
        throw TradingError("Insufficient cash for this buy based on cash as of that date")
    }
}

fun requireSellShares(trades: List<Trade>, symbol: String, at: Long, qty: Int) {
    val longQty = maxOf(0, heldQtyUpTo(trades, symbol, at))
    if (longQty < qty) throw TradingError("Only $longQty share(s) of $symbol held as of that date")
}

fun requireCover(config: GameConfig, trades: List<Trade>, symbol: String, at: Long, qty: Int, delta: Long) {
    val shortQty = maxOf(0, -heldQtyUpTo(trades, symbol, at))
    if (shortQty < qty) throw TradingError("Only $shortQty share(s) short of $symbol held as of that date")
    if (cashUpTo(config, trades, at) + delta < 0) throw TradingError("Insufficient cash to cover this short")
}
