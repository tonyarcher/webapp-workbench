package stockgame.trading

import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue
import stockgame.domain.Quote
import stockgame.domain.TradingError
import stockgame.store.GameStore

private val BARS = listOf(
    dayBar("2024-01-02", 100.0),
    dayBar("2024-01-03", 105.0),
    dayBar("2024-01-04", 110.0),
    dayBar("2024-01-05", 115.0),
    dayBar("2024-01-08", 120.0),
)
private val EARLY = Instant.parse("2023-01-01T00:00:00Z").toEpochMilli()
private val USER = UUID.fromString("00000000-0000-4000-8000-000000000001")
private val OTHER = UUID.fromString("00000000-0000-4000-8000-000000000002")

private fun at(day: String): Long = Instant.parse("${day}T00:00:00Z").toEpochMilli()

private fun backdate(symbol: String, side: String, qty: Int, day: String): BackdatedRequest =
    BackdatedRequest(symbol, side, qty, at(day), "market", null, null)

private class Services(val trading: TradingService, val accounts: AccountService, val store: GameStore)

private fun services(provider: FakeProvider, clock: Clock): Services {
    val store = FakeGameStore()
    val trading = TradingService(store, provider, clock, "fake")
    return Services(trading, AccountService(store, provider, clock, "fake"), store)
}

class TradingServiceTest {
    @Test
    fun backdatedFillsAtClose() {
        val svc = services(FakeProvider(BARS), Clock.systemUTC())
        svc.trading.updateConfig(USER, 10_000_000, EARLY, "fake", 15, 0)
        val at = Instant.parse("2024-01-02T10:00:00Z").toEpochMilli()
        val trade = svc.trading.placeBackdatedTrade(USER, BackdatedRequest("AAPL", "buy", 10, at, "market", null, null))
        assertEquals(100.0, trade.price)
        assertEquals(-100_000, trade.cashDeltaCents)
        assertEquals("backdated", trade.mode)
        assertEquals(BARS[0].time, trade.executedAt)
    }

    @Test
    fun rejectsBeforeStart() {
        val svc = services(FakeProvider(BARS), Clock.systemUTC())
        svc.trading.updateConfig(USER, 10_000_000, at("2024-01-03"), "fake", 15, 0)
        assertFailsWith<TradingError> {
            svc.trading.placeBackdatedTrade(USER, backdate("AAPL", "buy", 1, "2024-01-02"))
        }
    }

    @Test
    fun longWinner() {
        val bars = listOf(dayBar("2024-01-02", 100.0), dayBar("2024-01-04", 110.0))
        val svc = services(FakeProvider(bars), Clock.systemUTC())
        svc.trading.updateConfig(USER, 10_000_000, EARLY, "fake", 15, 0)
        svc.trading.placeBackdatedTrade(USER, backdate("AAPL", "buy", 10, "2024-01-02"))
        svc.trading.placeBackdatedTrade(USER, backdate("AAPL", "sell", 10, "2024-01-04"))
        assertEquals(10_000_000 + 10_000, svc.accounts.cashNowCents(USER))
        assertEquals(0, svc.accounts.heldQty(USER, "AAPL"))
    }

    @Test
    fun limitBuyFillsAtLimit() {
        val bars = listOf(dayBar("2024-01-02", 101.0, low = 99.0, high = 110.0))
        val svc = services(FakeProvider(bars), Clock.systemUTC())
        svc.trading.updateConfig(USER, 10_000_000, EARLY, "fake", 15, 0)
        val req = BackdatedRequest("AAPL", "buy", 10, at("2024-01-02"), "limit", 100.0, null)
        assertEquals(100.0, svc.trading.placeBackdatedTrade(USER, req).price)
    }

    @Test
    fun scheduledFill() {
        val now = Instant.parse("2024-01-03T15:00:00Z")
        val clock = Clock.fixed(now, ZoneOffset.UTC)
        val quote = Quote("AAPL", "Apple", 90.0, "USD", "T", 0, 0)
        val svc = services(FakeProvider(quote = quote), clock)
        val req = OrderRequest("AAPL", "buy", 2, now.toEpochMilli() + 5_000, "market", "GTC", null, null, null)
        svc.trading.placeOrder(USER, req)
        assertEquals(1, svc.trading.executeDueOrders(USER, now.toEpochMilli() + 10_000))
        assertEquals("filled", svc.trading.listOrders(USER)[0].status)
        assertEquals(2, svc.accounts.heldQty(USER, "AAPL"))
    }

    @Test
    fun commissionOnBackdated() {
        val bars = listOf(dayBar("2024-01-02", 100.0))
        val svc = services(FakeProvider(bars), Clock.systemUTC())
        svc.trading.updateConfig(USER, 10_000_000, EARLY, "fake", 15, 100)
        val trade = svc.trading.placeBackdatedTrade(USER, backdate("AAPL", "buy", 10, "2024-01-02"))
        assertEquals(-100_100, trade.cashDeltaCents)
        assertEquals(10_000_000 - 100_100, svc.accounts.cashNowCents(USER))
    }

    @Test
    fun usersCannotSeeEachOthersPortfolios() {
        val bars = listOf(dayBar("2024-01-02", 100.0))
        val svc = services(FakeProvider(bars), Clock.systemUTC())
        svc.trading.updateConfig(USER, 10_000_000, EARLY, "fake", 15, 0)
        svc.trading.placeBackdatedTrade(USER, backdate("AAPL", "buy", 10, "2024-01-02"))
        assertTrue(svc.trading.listTrades(OTHER).isEmpty())
        assertEquals(10_000_000, svc.accounts.cashNowCents(OTHER))
        assertEquals(0, svc.accounts.heldQty(OTHER, "AAPL"))
        assertEquals(10, svc.accounts.heldQty(USER, "AAPL"))
    }

    @Test
    fun fillsAndCancelsAreUserScoped() {
        val now = Instant.parse("2024-01-03T15:00:00Z")
        val clock = Clock.fixed(now, ZoneOffset.UTC)
        val quote = Quote("AAPL", "Apple", 90.0, "USD", "T", 0, 0)
        val svc = services(FakeProvider(quote = quote), clock)
        val order = svc.trading.placeOrder(
            USER,
            OrderRequest("AAPL", "buy", 2, now.toEpochMilli() + 5_000, "market", "GTC", null, null, null),
        )
        assertEquals(0, svc.trading.executeDueOrders(OTHER, now.toEpochMilli() + 10_000))
        assertEquals("pending", svc.trading.listOrders(USER)[0].status)
        svc.trading.cancelOrder(OTHER, order.id)
        assertEquals("pending", svc.trading.listOrders(USER)[0].status)
        assertEquals(1, svc.trading.executeDueOrders(USER, now.toEpochMilli() + 10_000))
        assertEquals("filled", svc.trading.listOrders(USER)[0].status)
    }
}
