package stockgame.domain

fun shouldFillQuote(
    quote: Double,
    side: String,
    orderType: String,
    limitPrice: Double?,
    stopPrice: Double?,
): Boolean {
    if (orderType == "market") return true
    if (orderType == "limit") return shouldLimit(quote, side, limitPrice)
    if (orderType == "stop") return shouldStop(quote, side, stopPrice)
    return shouldStopLimit(quote, side, limitPrice, stopPrice)
}

private fun shouldLimit(quote: Double, side: String, limit: Double?): Boolean {
    if (limit == null) return false
    return if (side == "buy" || side == "cover") quote <= limit else quote >= limit
}

private fun shouldStop(quote: Double, side: String, stop: Double?): Boolean {
    if (stop == null) return false
    return if (side == "sell" || side == "short") quote <= stop else quote >= stop
}

private fun shouldStopLimit(quote: Double, side: String, limit: Double?, stop: Double?): Boolean {
    if (limit == null || stop == null) return false
    return if (side == "sell" || side == "short") quote <= stop && quote >= limit
    else quote >= stop && quote <= limit
}

fun quoteFillPrice(quote: Quote, source: String): Double {
    if (source == "last") return quote.price
    if (source == "bid") return quote.bid?.takeIf { it > 0 } ?: quote.price
    if (source == "ask") return quote.ask?.takeIf { it > 0 } ?: quote.price
    val bid = quote.bid
    val ask = quote.ask
    if (bid != null && bid > 0 && ask != null && ask > 0) return (bid + ask) / 2
    return quote.price
}
