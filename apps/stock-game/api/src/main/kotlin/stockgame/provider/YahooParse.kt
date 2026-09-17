package stockgame.provider

import com.fasterxml.jackson.databind.JsonNode
import stockgame.domain.Bar
import stockgame.domain.ProviderError
import stockgame.domain.Quote
import stockgame.domain.round2

fun parseYahooQuote(symbol: String, chart: JsonNode, book: JsonNode?): Quote {
    val block = chartBlock(chart)
    val bars = parseYahooBars(block)
    val meta = block.path("meta")
    val sym = textOr(meta, "symbol") ?: throw ProviderError("No quote data for $symbol")
    val price = quotePrice(meta, bars, symbol)
    val time = quoteTime(meta, bars)
    val base = Quote(
        symbol = sym,
        name = textOr(meta, "shortName") ?: textOr(meta, "longName") ?: symbol,
        price = round2(price),
        currency = textOr(meta, "currency") ?: "USD",
        exchange = textOr(meta, "fullExchangeName") ?: textOr(meta, "exchangeName") ?: "",
        time = time,
        delayMinutes = 15,
    )
    return mergeBook(base, book)
}

fun parseYahooBars(block: JsonNode): List<Bar> {
    val timestamps = block.path("timestamp")
    val quote = block.path("indicators").path("quote").path(0)
    if (!timestamps.isArray || quote.isMissingNode) return emptyList()
    return timestamps.mapIndexedNotNull { i, t ->
        val quoteAt = quoteAt(quote, i)
        barAt(t, quoteAt[0], quoteAt[1], quoteAt[2], quoteAt[3], quoteAt[4])
    }
}

internal fun chartBlock(json: JsonNode): JsonNode {
    val result = json.path("chart").path("result")
    if (!result.isArray || result.size() == 0) throw ProviderError("Yahoo Finance returned no data")
    return result.path(0)
}

private fun barAt(
    timeNode: JsonNode,
    open: JsonNode,
    high: JsonNode,
    low: JsonNode,
    close: JsonNode,
    volume: JsonNode,
): Bar? {
    if (!timeNode.isNumber || !close.isNumber) return null
    val closeV = close.asDouble()
    val openV = if (open.isNumber) open.asDouble() else closeV
    val highV = if (high.isNumber) high.asDouble() else closeV
    val lowV = if (low.isNumber) low.asDouble() else closeV
    val vol = if (volume.isNumber) volume.asLong() else 0L
    if (!listOf(openV, highV, lowV, closeV).all { it.isFinite() }) return null
    return Bar(timeNode.asLong() * 1000, openV, highV, lowV, closeV, vol)
}

private fun mergeBook(base: Quote, book: JsonNode?): Quote {
    if (book == null) return base
    val first = book.path("quoteResponse").path("result").path(0)
    if (first.isMissingNode) return base
    val bid = first.path("bid").takeIf { it.isNumber && it.asDouble() > 0 }?.asDouble()
    val ask = first.path("ask").takeIf { it.isNumber && it.asDouble() > 0 }?.asDouble()
    if (bid == null && ask == null) return base
    return base.copy(bid = bid, ask = ask)
}

private fun quoteAt(quote: JsonNode, i: Int): List<JsonNode> = listOf(
    quote.path("open").path(i),
    quote.path("high").path(i),
    quote.path("low").path(i),
    quote.path("close").path(i),
    quote.path("volume").path(i),
)

private fun quotePrice(meta: JsonNode, bars: List<Bar>, symbol: String): Double {
    val price = numOrNull(meta, "regularMarketPrice") ?: bars.lastOrNull()?.close
        ?: throw ProviderError("No quote data for $symbol")
    if (!price.isFinite()) throw ProviderError("No quote data for $symbol")
    return price
}

private fun quoteTime(meta: JsonNode, bars: List<Bar>): Long {
    if (meta.path("regularMarketTime").isNumber) return meta.path("regularMarketTime").asLong() * 1000
    return bars.lastOrNull()?.time ?: System.currentTimeMillis()
}
