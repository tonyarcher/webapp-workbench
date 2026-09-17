package stockgame.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

private fun trade(symbol: String, side: String, qty: Int, price: Double): Trade = Trade(
    id = 1,
    symbol = symbol,
    side = side,
    qty = qty,
    price = price,
    cashDeltaCents = 0,
    mode = "backdated",
    executedAt = 1,
    createdAt = 1,
)

private fun bar(high: Double, low: Double, close: Double): Bar =
    Bar(time = 1, open = close, high = high, low = low, close = close, volume = 10)

class PositionFillsBranchTest {
    @Test
    fun openingIncreasing() {
        val open = accumulatePositions(listOf(trade("AAPL", "buy", 10, 50.0)))
        assertEquals(10, open["AAPL"]?.qty)
        val inc = accumulatePositions(
            listOf(trade("AAPL", "buy", 10, 50.0), trade("AAPL", "buy", 5, 60.0)),
        )
        assertEquals(15, inc["AAPL"]?.qty)
    }

    @Test
    fun reduceAndClose() {
        val pos = accumulatePositions(
            listOf(trade("AAPL", "buy", 10, 50.0), trade("AAPL", "sell", 4, 60.0)),
        )
        assertEquals(6, pos["AAPL"]?.qty)
        val flat = accumulatePositions(
            listOf(trade("AAPL", "buy", 10, 50.0), trade("AAPL", "sell", 10, 60.0)),
        )
        assertEquals(0, flat["AAPL"]?.qty)
    }

    @Test
    fun marketLimitStop() {
        val b = bar(high = 55.0, low = 45.0, close = 50.0)
        assertEquals(50.0, fillPriceForBar(b, "buy", "market", null, null))
        assertEquals(50.0, fillPriceForBar(b, "buy", "limit", 60.0, null))
        assertNull(fillPriceForBar(b, "buy", "limit", 40.0, null))
        assertNull(fillPriceForBar(b, "buy", "limit", null, null))
        assertEquals(50.0, fillPriceForBar(b, "sell", "limit", 40.0, null))
        assertNull(fillPriceForBar(b, "sell", "limit", 60.0, null))
        assertEquals(50.0, fillPriceForBar(b, "cover", "limit", 60.0, null))
        assertNull(fillPriceForBar(b, "cover", "limit", 40.0, null))
        assertEquals(50.0, fillPriceForBar(b, "buy", "stop", null, 40.0))
        assertNull(fillPriceForBar(b, "buy", "stop", null, 60.0))
        assertNull(fillPriceForBar(b, "buy", "stop", null, null))
        assertEquals(50.0, fillPriceForBar(b, "sell", "stop", null, 60.0))
        assertNull(fillPriceForBar(b, "sell", "stop", null, 40.0))
        assertEquals(50.0, fillPriceForBar(b, "short", "stop", null, 60.0))
        assertNull(fillPriceForBar(b, "short", "stop", null, 40.0))
    }

    @Test
    fun stopLimitBothSides() {
        val b = bar(high = 55.0, low = 45.0, close = 50.0)
        assertNull(fillPriceForBar(b, "buy", "stop-limit", null, null))
        assertEquals(50.0, fillPriceForBar(b, "buy", "stop-limit", 60.0, 40.0))
        assertNull(fillPriceForBar(b, "buy", "stop-limit", 40.0, 60.0))
        assertNull(fillPriceForBar(b, "buy", "stop-limit", 30.0, 40.0))
        assertEquals(50.0, fillPriceForBar(b, "sell", "stop-limit", 40.0, 60.0))
        assertNull(fillPriceForBar(b, "sell", "stop-limit", 60.0, 40.0))
        assertNull(fillPriceForBar(b, "sell", "stop-limit", 60.0, 60.0))
        assertEquals(50.0, fillPriceForBar(b, "short", "stop-limit", 40.0, 60.0))
        assertNull(fillPriceForBar(b, "short", "stop-limit", 60.0, 40.0))
        assertEquals(50.0, fillPriceForBar(b, "cover", "stop-limit", 60.0, 40.0))
        assertNull(fillPriceForBar(b, "cover", "stop-limit", 40.0, 60.0))
        assertEquals(50.0, fillPriceForBar(b, "buy", "weird-type", 60.0, 40.0))
    }
}
