package stockgame.domain

fun fillPriceForBar(
    bar: Bar,
    side: String,
    orderType: String,
    limitPrice: Double?,
    stopPrice: Double?,
): Double? {
    if (orderType == "market") return bar.close
    if (orderType == "limit") return fillLimit(bar, side, limitPrice)
    if (orderType == "stop") return fillStop(bar, side, stopPrice)
    return fillStopLimit(bar, side, limitPrice, stopPrice)
}

private fun fillLimit(bar: Bar, side: String, limit: Double?): Double? {
    if (limit == null) return null
    if (side == "buy" || side == "cover") {
        if (bar.low <= limit) return minOf(bar.close, limit)
        return null
    }
    if (bar.high >= limit) return maxOf(bar.close, limit)
    return null
}

private fun fillStop(bar: Bar, side: String, stop: Double?): Double? {
    if (stop == null) return null
    if (side == "sell" || side == "short") {
        if (bar.low <= stop) return bar.close
        return null
    }
    if (bar.high >= stop) return bar.close
    return null
}

private fun fillStopLimit(bar: Bar, side: String, limit: Double?, stop: Double?): Double? {
    if (limit == null || stop == null) return null
    if (side == "sell" || side == "short") {
        if (bar.low <= stop && bar.high >= limit) return maxOf(bar.close, limit)
        return null
    }
    if (bar.high >= stop && bar.low <= limit) return minOf(bar.close, limit)
    return null
}
