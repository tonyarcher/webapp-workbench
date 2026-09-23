package stockgame.trading

import stockgame.domain.GameConfig
import stockgame.domain.TradingError
import java.time.Instant
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class BackdatedBranchTest {
    private val store = FakeGameStore()
    private val user = UUID.randomUUID()
    private val bars = listOf(dayBar("2024-01-02", 100.0), dayBar("2024-01-03", 105.0))
    private val provider = FakeProvider(bars)
    private val now = Instant.parse("2024-01-10T00:00:00Z").toEpochMilli()

    private fun at(day: String): Long = Instant.parse("${day}T00:00:00Z").toEpochMilli()

    private fun setup() {
        store.saveConfig(user, GameConfig(10_000_000L, at("2024-01-01"), "fake"))
    }

    private fun req(symbol: String, side: String, qty: Int, day: String, type: String = "market"): BackdatedRequest =
        BackdatedRequest(symbol, side, qty, at(day), type, null, null)

    private fun place(req: BackdatedRequest) = placeBackdated(store, provider, "fake", user, req, now)

    @Test
    fun beforeStartRejected() {
        setup()
        assertFailsWith<TradingError> { place(req("AAPL", "buy", 1, "2023-12-01")) }
    }

    @Test
    fun noBarRejected() {
        setup()
        assertFailsWith<TradingError> { place(req("AAPL", "buy", 1, "2025-06-01")) }
    }

    @Test
    fun noFillRejected() {
        setup()
        val limit = BackdatedRequest("AAPL", "buy", 1, at("2024-01-02"), "limit", 1.0, null)
        assertFailsWith<TradingError> { place(limit) }
    }

    @Test
    fun shortSkipsValidation() {
        setup()
        val trade = place(req("AAPL", "short", 2, "2024-01-02"))
        assertEquals("short", trade.side)
        val cover = place(req("AAPL", "cover", 2, "2024-01-03"))
        assertEquals("cover", cover.side)
    }

    @Test
    fun insufficientCashRejected() {
        setup()
        assertFailsWith<TradingError> { place(req("AAPL", "buy", 1_000_000, "2024-01-02")) }
    }
}
