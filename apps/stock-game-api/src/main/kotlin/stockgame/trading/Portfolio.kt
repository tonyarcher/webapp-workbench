package stockgame.trading

import stockgame.domain.GameConfig
import stockgame.domain.PortfolioPoint
import stockgame.domain.PortfolioSeries
import stockgame.domain.Trade
import stockgame.domain.round2
import stockgame.domain.signedQty
import stockgame.provider.PriceProvider

private const val DAY_MS = 24 * 60 * 60 * 1000L

fun portfolioSeries(provider: PriceProvider, config: GameConfig, trades: List<Trade>, now: Long): PortfolioSeries {
    val startDate = minOf(config.startDate, now)
    val ordered = trades.sortedBy { it.executedAt }
    val symbols = ordered.map { it.symbol }.distinct()
    val barsBySymbol = loadCloses(provider, symbols, startDate, now)
    val days = collectDays(startDate, now, ordered, barsBySymbol)
    val points = buildPoints(days, ordered, barsBySymbol, config.startingCashCents)
    val last = points.lastOrNull()
    val ret = if (last == null || config.startingCashCents <= 0) 0.0
    else ((last.totalCents - config.startingCashCents).toDouble() / config.startingCashCents) * 100
    return PortfolioSeries(
        startingCashCents = config.startingCashCents,
        startDate = days.firstOrNull() ?: startDate,
        endDate = last?.time ?: now,
        totalReturnPct = round2(ret),
        points = points,
        totalGainCents = last?.gainCents ?: 0,
    )
}

private fun loadCloses(
    provider: PriceProvider,
    symbols: List<String>,
    startDate: Long,
    now: Long,
): Map<String, List<Pair<Long, Double>>> {
    val from = startDate - DAY_MS
    val to = now + DAY_MS
    return symbols.associateWith { symbol ->
        provider.getBars(symbol, "1d", from, to).map { it.time to it.close }
    }
}

private fun collectDays(
    startDate: Long,
    now: Long,
    trades: List<Trade>,
    bars: Map<String, List<Pair<Long, Double>>>,
): List<Long> {
    val days = mutableSetOf(dayOf(startDate), dayOf(now))
    trades.forEach { days.add(dayOf(it.executedAt)) }
    bars.values.forEach { list -> list.forEach { days.add(dayOf(it.first)) } }
    return days.sorted()
}

private fun buildPoints(
    days: List<Long>,
    trades: List<Trade>,
    bars: Map<String, List<Pair<Long, Double>>>,
    startingCash: Long,
): List<PortfolioPoint> {
    val qty = mutableMapOf<String, Int>()
    val lastClose = mutableMapOf<String, Double>()
    val barIndex = mutableMapOf<String, Int>()
    var cash = startingCash
    var ti = 0
    return days.map { day ->
        val end = day + DAY_MS - 1
        while (ti < trades.size && trades[ti].executedAt <= end) {
            val t = trades[ti]
            cash += t.cashDeltaCents
            qty[t.symbol] = (qty[t.symbol] ?: 0) + signedQty(t.side, t.qty)
            ti += 1
        }
        val holdings = holdingsCents(qty, lastClose, barIndex, bars, end)
        val total = cash + holdings
        PortfolioPoint(day, cash, holdings, total, total - startingCash)
    }
}

private fun holdingsCents(
    qty: Map<String, Int>,
    lastClose: MutableMap<String, Double>,
    barIndex: MutableMap<String, Int>,
    bars: Map<String, List<Pair<Long, Double>>>,
    end: Long,
): Long {
    var sum = 0L
    for ((symbol, q) in qty) {
        sum += positionValue(symbol, q, lastClose, barIndex, bars, end) ?: 0L
    }
    return sum
}

private fun positionValue(
    symbol: String,
    q: Int,
    lastClose: MutableMap<String, Double>,
    barIndex: MutableMap<String, Int>,
    bars: Map<String, List<Pair<Long, Double>>>,
    end: Long,
): Long? {
    if (q == 0) return null
    val series = bars[symbol] ?: return null
    var i = barIndex[symbol] ?: 0
    while (i < series.size && series[i].first <= end) {
        lastClose[symbol] = series[i].second
        i += 1
    }
    barIndex[symbol] = i
    val close = lastClose[symbol] ?: return null
    return Math.round(q * close * 100)
}

private fun dayOf(ms: Long): Long = (ms / DAY_MS) * DAY_MS
