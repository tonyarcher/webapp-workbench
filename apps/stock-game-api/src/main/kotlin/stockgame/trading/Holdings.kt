package stockgame.trading

import stockgame.domain.HoldingsEntry
import stockgame.domain.Position
import stockgame.domain.accumulatePositions
import stockgame.domain.round2
import stockgame.provider.PriceProvider
import stockgame.store.GameStore

fun holdings(store: GameStore, provider: PriceProvider): List<HoldingsEntry> {
    val state = accumulatePositions(store.listTrades())
    val entries = state.mapNotNull { (symbol, pos) ->
        if (pos.qty == 0) null else oneHolding(provider, symbol, pos)
    }
    return entries.sortedByDescending { it.marketValueCents }
}

private fun oneHolding(provider: PriceProvider, symbol: String, state: Position): HoldingsEntry {
    val avg = Math.round(state.totalCostCents.toDouble() / Math.abs(state.qty))
    val quote = runCatching { provider.getQuote(symbol) }.getOrNull()
    val price = quote?.price ?: (avg / 100.0)
    val name = quote?.name ?: symbol
    val market = Math.round(state.qty * price * 100)
    val cost = Math.abs(state.qty) * avg
    val shortPos = state.qty < 0
    val pnl = if (shortPos) cost - Math.abs(market) else market - cost
    val pct = if (cost > 0) (pnl.toDouble() / cost) * 100 else 0.0
    return HoldingsEntry(symbol, name, state.qty, avg, cost, price, market, pnl, round2(pct))
}
