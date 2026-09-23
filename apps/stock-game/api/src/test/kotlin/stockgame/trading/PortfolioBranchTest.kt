package stockgame.trading

import stockgame.domain.GameConfig
import stockgame.domain.Trade
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class PortfolioBranchTest {
    private fun trade(symbol: String, side: String, qty: Int, at: Long, delta: Long): Trade = Trade(
        id = 1,
        symbol = symbol,
        side = side,
        qty = qty,
        price = 10.0,
        cashDeltaCents = delta,
        mode = "backdated",
        executedAt = at,
        createdAt = at,
    )

    private fun dayBar(time: Long, close: Double): stockgame.domain.Bar =
        stockgame.domain.Bar(time, close, close, close, close, 100)

    @Test
    fun emptyTrades() {
        val config = GameConfig(1_000_000L, 1_700_000_000_000L, "fake")
        val series = portfolioSeries(FakeProvider(), config, emptyList(), 1_700_100_000_000L)
        assertEquals(1_000_000L, series.startingCashCents)
        assertEquals(0L, series.totalGainCents)
        assertTrue(series.points.isNotEmpty())
    }

    @Test
    fun futureStartClamped() {
        val now = 1_700_100_000_000L
        val config = GameConfig(1_000_000L, 9_999_999_999_999L, "fake")
        val series = portfolioSeries(FakeProvider(), config, emptyList(), now)
        assertEquals(1, series.points.size)
        assertEquals(0L, series.totalGainCents)
    }

    @Test
    fun zeroCash() {
        val config = GameConfig(0L, 1_700_000_000_000L, "fake")
        val series = portfolioSeries(FakeProvider(), config, emptyList(), 1_700_100_000_000L)
        assertEquals(0.0, series.totalReturnPct)
    }

    @Test
    fun holdingsValuedFromBars() {
        val t0 = Instant.parse("2024-01-02T14:30:00Z").toEpochMilli()
        val bars = listOf(dayBar(t0, 100.0), dayBar(t0 + 86_400_000L, 110.0))
        val provider = FakeProvider(bars)
        val config = GameConfig(1_000_000L, t0 - 86_400_000L, "fake")
        val trades = listOf(trade("AAPL", "buy", 10, t0, -100_000L))
        val series = portfolioSeries(provider, config, trades, t0 + 2 * 86_400_000L)
        assertTrue(series.points.any { it.holdingsCents != 0L })
        assertTrue(series.points.last().totalCents != 0L)
    }

    @Test
    fun flatPositionSkipped() {
        val t0 = Instant.parse("2024-01-02T14:30:00Z").toEpochMilli()
        val bars = listOf(dayBar(t0, 100.0))
        val provider = FakeProvider(bars)
        val config = GameConfig(1_000_000L, t0 - 86_400_000L, "fake")
        val trades =
            listOf(
                trade("AAPL", "buy", 10, t0, -100_000L),
                trade("AAPL", "sell", 10, t0, 100_000L),
            )
        val series = portfolioSeries(provider, config, trades, t0 + 86_400_000L)
        assertTrue(series.points.all { it.holdingsCents == 0L })
    }

    @Test
    fun missingBarsValuedZero() {
        val config = GameConfig(1_000_000L, 1_700_000_000_000L, "fake")
        val emptyBars =
            object : stockgame.provider.PriceProvider {
                override val id: String = "empty"

                override fun getQuote(symbol: String): stockgame.domain.Quote =
                    stockgame.domain.Quote(symbol, symbol, 10.0, "USD", "T", 0, 0)

                override fun getBars(symbol: String, interval: String, from: Long, to: Long) =
                    emptyList<stockgame.domain.Bar>()

                override fun search(query: String) = emptyList<stockgame.domain.SymbolHit>()
            }
        val trades = listOf(trade("AAPL", "buy", 10, 1_700_000_000_000L, -100_000L))
        val series = portfolioSeries(emptyBars, config, trades, 1_700_100_000_000L)
        assertTrue(series.points.all { it.holdingsCents == 0L })
    }
}
