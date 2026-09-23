package stockgame.web

import org.springframework.http.HttpStatus

private val SIDES = setOf("buy", "sell", "short", "cover")
private val ORDER_TYPES = setOf("market", "limit", "stop", "stopLimit")
private val TIFS = setOf("DAY", "GTC")
private val FILL_SOURCES = setOf("last", "bid", "ask", "mid")

internal fun requireSide(side: String): String {
    if (side !in SIDES) throw ApiException(HttpStatus.BAD_REQUEST, "invalid side")
    return side
}

internal fun requireOrderType(orderType: String): String {
    if (orderType !in ORDER_TYPES) throw ApiException(HttpStatus.BAD_REQUEST, "invalid orderType")
    return orderType
}

internal fun requirePrices(orderType: String, limitPrice: Double?, stopPrice: Double?) {
    if ((orderType == "limit" || orderType == "stopLimit") && !isPositive(limitPrice)) {
        throw ApiException(HttpStatus.BAD_REQUEST, "limitPrice required for limit orders")
    }
    if ((orderType == "stop" || orderType == "stopLimit") && !isPositive(stopPrice)) {
        throw ApiException(HttpStatus.BAD_REQUEST, "stopPrice required for stop orders")
    }
}

internal fun requireTif(tif: String): String {
    if (tif !in TIFS) throw ApiException(HttpStatus.BAD_REQUEST, "invalid tif")
    return tif
}

internal fun requireFillSource(source: String): String {
    if (source !in FILL_SOURCES) throw ApiException(HttpStatus.BAD_REQUEST, "invalid fillPriceSource")
    return source
}

private fun isPositive(value: Double?): Boolean = value != null && value.isFinite() && value > 0
