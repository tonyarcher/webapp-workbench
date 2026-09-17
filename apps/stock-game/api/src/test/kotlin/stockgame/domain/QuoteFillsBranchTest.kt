package stockgame.domain

import kotlin.test.Test
import kotlin.test.assertEquals

class QuoteFillsBranchTest {
    @Test
    fun limitDecisions() {
        assertEquals(true, shouldFillQuote(50.0, "buy", "market", null, null))
        assertEquals(true, shouldFillQuote(50.0, "buy", "limit", 60.0, null))
        assertEquals(false, shouldFillQuote(70.0, "buy", "limit", 60.0, null))
        assertEquals(false, shouldFillQuote(50.0, "buy", "limit", null, null))
        assertEquals(true, shouldFillQuote(50.0, "sell", "limit", 40.0, null))
        assertEquals(true, shouldFillQuote(50.0, "short", "limit", 40.0, null))
        assertEquals(false, shouldFillQuote(30.0, "short", "limit", 40.0, null))
        assertEquals(true, shouldFillQuote(50.0, "cover", "limit", 60.0, null))
        assertEquals(false, shouldFillQuote(70.0, "cover", "limit", 60.0, null))
    }

    @Test
    fun stopDecisions() {
        assertEquals(true, shouldFillQuote(50.0, "buy", "stop", null, 40.0))
        assertEquals(false, shouldFillQuote(50.0, "buy", "stop", null, null))
        assertEquals(true, shouldFillQuote(30.0, "sell", "stop", null, 40.0))
        assertEquals(true, shouldFillQuote(30.0, "short", "stop", null, 40.0))
        assertEquals(false, shouldFillQuote(50.0, "short", "stop", null, 40.0))
        assertEquals(true, shouldFillQuote(50.0, "cover", "stop", null, 40.0))
        assertEquals(false, shouldFillQuote(30.0, "cover", "stop", null, 40.0))
    }

    @Test
    fun stopLimitDecisions() {
        assertEquals(true, shouldFillQuote(50.0, "buy", "stop-limit", 60.0, 40.0))
        assertEquals(false, shouldFillQuote(50.0, "buy", "stop-limit", null, null))
        assertEquals(false, shouldFillQuote(50.0, "buy", "stop-limit", 45.0, 40.0))
        assertEquals(true, shouldFillQuote(45.0, "sell", "stop-limit", 40.0, 50.0))
        assertEquals(false, shouldFillQuote(55.0, "sell", "stop-limit", 40.0, 50.0))
        assertEquals(false, shouldFillQuote(45.0, "sell", "stop-limit", 50.0, 60.0))
        assertEquals(true, shouldFillQuote(45.0, "short", "stop-limit", 40.0, 50.0))
        assertEquals(false, shouldFillQuote(55.0, "short", "stop-limit", 40.0, 50.0))
        assertEquals(false, shouldFillQuote(45.0, "short", "stop-limit", 50.0, 60.0))
    }

    @Test
    fun quoteSources() {
        val q = Quote("AAPL", "Apple", 50.0, "USD", "X", 1, bid = 49.0, ask = 51.0)
        assertEquals(50.0, quoteFillPrice(q, "last"))
        assertEquals(49.0, quoteFillPrice(q, "bid"))
        assertEquals(51.0, quoteFillPrice(q, "ask"))
        assertEquals(50.0, quoteFillPrice(q, "mid"))
        assertEquals(50.0, quoteFillPrice(q, "unknown-source"))
        val noBid = q.copy(bid = null)
        assertEquals(50.0, quoteFillPrice(noBid, "bid"))
        assertEquals(50.0, quoteFillPrice(noBid, "mid"))
        val bidOnly = Quote("A", "a", 50.0, "USD", "X", 1, bid = 49.0)
        assertEquals(50.0, quoteFillPrice(bidOnly, "mid"))
        val badAsk = q.copy(bid = 49.0, ask = -1.0)
        assertEquals(50.0, quoteFillPrice(badAsk, "mid"))
        val zero = q.copy(bid = 0.0, ask = -1.0)
        assertEquals(50.0, quoteFillPrice(zero, "bid"))
        assertEquals(50.0, quoteFillPrice(zero, "ask"))
        assertEquals(50.0, quoteFillPrice(zero, "mid"))
    }
}
