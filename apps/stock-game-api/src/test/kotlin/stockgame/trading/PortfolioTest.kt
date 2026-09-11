package stockgame.trading

import java.time.Clock
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class PortfolioTest {
    @Test
    fun replaysCashAndHoldings() {
        val bars = listOf(dayBar("2024-01-02", 100.0), dayBar("2024-01-04", 110.0))
        val store = FakeGameStore()
        val provider = FakeProvider(bars)
        val clock = Clock.systemUTC()
        val trading = TradingService(store, provider, clock, "fake")
        trading.updateConfig(10_000_000, 0, "fake", 15, 0)
        trading.placeBackdatedTrade(
            BackdatedRequest("AAPL", "buy", 10, bars[0].time, "market", null, null),
        )
        val series = portfolioSeries(provider, trading.getConfig(), trading.listTrades(), bars[1].time)
        assertEquals(10_000_000, series.startingCashCents)
        assertTrue(series.points.size >= 2)
        val last = series.points.last()
        assertEquals(bars[1].time.let { (it / 86_400_000) * 86_400_000 }, last.time)
        assertEquals(10_000_000 - 100_000, last.cashCents)
        assertEquals(10 * 11000, last.holdingsCents)
        assertEquals(10_000, last.gainCents)
    }
}
