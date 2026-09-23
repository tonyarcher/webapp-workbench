package stockgame.trading

import java.time.Clock
import java.time.Instant
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals

class HoldingsBranchTest {
    private val bars =
        listOf(
            dayBar("2024-01-02", 100.0),
            dayBar("2024-01-03", 105.0),
        )

    private fun at(day: String): Long = Instant.parse("${day}T00:00:00Z").toEpochMilli()

    private fun filled(store: FakeGameStore, uid: UUID): TradingService {
        val svc = TradingService(store, FakeProvider(bars), Clock.systemUTC(), "fake")
        svc.updateConfig(uid, 1_000_000L, at("2024-01-01"), null, null, null)
        svc.placeBackdatedTrade(
            uid,
            BackdatedRequest("AAPL", "buy", 10, at("2024-01-02"), "market", null, null),
        )
        return svc
    }

    @Test
    fun emptyWhenFlat() {
        val store = FakeGameStore()
        assertEquals(emptyList(), holdings(store, FakeProvider(), UUID.randomUUID()))
    }

    @Test
    fun longPosition() {
        val store = FakeGameStore()
        val uid = UUID.randomUUID()
        filled(store, uid)
        val entries = holdings(store, FakeProvider(bars), uid)
        assertEquals(1, entries.size)
        assertEquals(10, entries[0].qty)
        assertEquals("AAPL", entries[0].symbol)
    }

    @Test
    fun providerFailureFallsBack() {
        val store = FakeGameStore()
        val uid = UUID.randomUUID()
        filled(store, uid)
        val failing =
            object : stockgame.provider.PriceProvider {
                override val id: String = "bad"

                override fun getQuote(symbol: String): stockgame.domain.Quote = throw IllegalStateException("down")

                override fun getBars(symbol: String, interval: String, from: Long, to: Long) =
                    emptyList<stockgame.domain.Bar>()

                override fun search(query: String) = emptyList<stockgame.domain.SymbolHit>()
            }
        val entries = holdings(store, failing, uid)
        assertEquals(1, entries.size)
        assertEquals("AAPL", entries[0].name)
    }

    @Test
    fun flatPositionFiltered() {
        val bars = listOf(dayBar("2024-01-02", 100.0), dayBar("2024-01-03", 105.0))
        val store = FakeGameStore()
        val svc = TradingService(store, FakeProvider(bars), Clock.systemUTC(), "fake")
        val uid = UUID.randomUUID()
        svc.updateConfig(uid, 1_000_000L, 1_700_000_000_000L, null, null, null)
        val day =
            java.time.Instant
                .parse("2024-01-02T00:00:00Z")
                .toEpochMilli()
        svc.placeBackdatedTrade(
            uid,
            BackdatedRequest("AAPL", "buy", 10, day, "market", null, null),
        )
        svc.placeBackdatedTrade(
            uid,
            BackdatedRequest("AAPL", "sell", 10, day, "market", null, null),
        )
        assertEquals(emptyList(), holdings(store, FakeProvider(bars), uid))
    }

    @Test
    fun shortPosition() {
        val bars = listOf(dayBar("2024-01-02", 100.0), dayBar("2024-01-03", 105.0))
        val store = FakeGameStore()
        val svc = TradingService(store, FakeProvider(bars), Clock.systemUTC(), "fake")
        val uid = UUID.randomUUID()
        svc.updateConfig(uid, 1_000_000L, 1_700_000_000_000L, null, null, null)
        val day =
            java.time.Instant
                .parse("2024-01-02T00:00:00Z")
                .toEpochMilli()
        svc.placeBackdatedTrade(
            uid,
            BackdatedRequest("AAPL", "short", 5, day, "market", null, null),
        )
        val entries = holdings(store, FakeProvider(bars), uid)
        assertEquals(1, entries.size)
        assertEquals(-5, entries[0].qty)
    }
}
