package stockgame.trading

import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import stockgame.domain.Quote
import stockgame.store.GameStore

class DueFillsBranchTest {
    private val now = Instant.parse("2024-01-03T15:00:00Z")
    private val user = UUID.randomUUID()

    private fun services(): TradingService {
        val bars = listOf(dayBar("2024-01-02", 100.0), dayBar("2024-01-03", 105.0))
        val store = FakeGameStore()
        val quote = Quote("AAPL", "Apple", 90.0, "USD", "T", 0, 0)
        return TradingService(store, FakeProvider(bars, quote), Clock.fixed(now, ZoneOffset.UTC), "fake")
    }

    private fun marketOrder(svc: TradingService, side: String = "buy", qty: Int = 2): Long {
        svc.updateConfig(user, 10_000_000, now.toEpochMilli() - 100_000, "fake", 15, 0)
        val order = svc.placeOrder(
            user,
            OrderRequest("AAPL", side, qty, now.toEpochMilli() + 5_000, "market", "GTC", null, null, null),
        )
        return order.id
    }

    @Test
    fun closedMarketSkips() {
        val svc = services()
        marketOrder(svc)
        val sunday = Instant.parse("2024-01-07T15:00:00Z").toEpochMilli()
        assertEquals(0, svc.executeDueOrders(user, sunday))
    }

    @Test
    fun notDueStaysPending() {
        val svc = services()
        marketOrder(svc)
        assertEquals(0, svc.executeDueOrders(user, now.toEpochMilli()))
    }

    @Test
    fun sellWithoutSharesCancels() {
        val svc = services()
        svc.updateConfig(user, 10_000_000, now.toEpochMilli() - 100_000, "fake", 15, 0)
        svc.placeOrder(
            user,
            OrderRequest("AAPL", "sell", 5, now.toEpochMilli() + 5_000, "market", "GTC", null, null, null),
        )
        assertEquals(0, svc.executeDueOrders(user, now.toEpochMilli() + 10_000))
        assertEquals("cancelled", svc.listOrders(user)[0].status)
    }

    @Test
    fun marketOrderFills() {
        val svc = services()
        marketOrder(svc)
        val order = svc.listOrders(user)[0]
        assertEquals("pending", order.status)
        assertEquals(1, svc.executeDueOrders(user, now.toEpochMilli() + 10_000))
        assertEquals("filled", svc.listOrders(user)[0].status)
    }

    @Test
    fun coverWithoutShortCancels() {
        val svc = services()
        svc.updateConfig(user, 10_000_000, now.toEpochMilli() - 100_000, "fake", 15, 0)
        svc.placeOrder(
            user,
            OrderRequest("AAPL", "cover", 2, now.toEpochMilli() + 5_000, "market", "GTC", null, null, null),
        )
        assertEquals(0, svc.executeDueOrders(user, now.toEpochMilli() + 10_000))
        assertEquals("cancelled", svc.listOrders(user)[0].status)
    }

    @Test
    fun expiredDayCancels() {
        val svc = services()
        svc.updateConfig(user, 10_000_000, now.toEpochMilli() - 100_000, "fake", 15, 0)
        svc.placeOrder(
            user,
            OrderRequest("AAPL", "buy", 2, now.toEpochMilli() + 5_000, "market", "DAY", null, null, null),
        )
        val farFuture = now.toEpochMilli() + 10 * 86_400_000L
        svc.executeDueOrders(user, farFuture)
        assertEquals("cancelled", svc.listOrders(user)[0].status)
    }

    @Test
    fun liveDayOrderFills() {
        val svc = services()
        svc.updateConfig(user, 10_000_000, now.toEpochMilli() - 100_000, "fake", 15, 0)
        svc.placeOrder(
            user,
            OrderRequest("AAPL", "buy", 2, now.toEpochMilli() + 5_000, "market", "DAY", null, null, null),
        )
        assertEquals(1, svc.executeDueOrders(user, now.toEpochMilli() + 10_000))
        assertEquals("filled", svc.listOrders(user)[0].status)
    }

    @Test
    fun limitMissStaysPending() {
        val svc = services()
        svc.updateConfig(user, 10_000_000, now.toEpochMilli() - 100_000, "fake", 15, 0)
        svc.placeOrder(
            user,
            OrderRequest("AAPL", "buy", 2, now.toEpochMilli() + 5_000, "limit", "GTC", 1.0, null, null),
        )
        assertEquals(0, svc.executeDueOrders(user, now.toEpochMilli() + 10_000))
        assertEquals("pending", svc.listOrders(user)[0].status)
    }

    @Test
    fun providerFailureSkipsFill() {
        val store = FakeGameStore()
        val failing = org.mockito.kotlin.mock<stockgame.provider.PriceProvider>()
        whenever(failing.getQuote("AAPL")).thenThrow(IllegalStateException("down"))
        val svc = TradingService(store, failing, Clock.fixed(now, ZoneOffset.UTC), "fake")
        svc.updateConfig(user, 10_000_000, now.toEpochMilli() - 100_000, "fake", 15, 0)
        svc.placeOrder(
            user,
            OrderRequest("AAPL", "buy", 2, now.toEpochMilli() + 5_000, "market", "GTC", null, null, null),
        )
        assertEquals(0, svc.executeDueOrders(user, now.toEpochMilli() + 10_000))
        assertEquals("pending", svc.listOrders(user)[0].status)
    }

    @Test
    fun stalePendingSkipped() {
        val store = mock<GameStore>()
        val filled = stockgame.domain.Order(
            id = 1,
            symbol = "AAPL",
            side = "buy",
            qty = 1,
            executeAt = now.toEpochMilli(),
            status = "filled",
            createdAt = now.toEpochMilli(),
            tradeId = 1,
            orderType = "market",
            tif = "GTC",
            limitPrice = null,
            stopPrice = null,
            expiresAt = null,
            fillPriceSource = "last",
        )
        whenever(store.listOrders(user)).thenReturn(listOf(filled))
        whenever(store.pendingOrders(user, now.toEpochMilli() + 10_000)).thenReturn(listOf(filled))
        val svc = TradingService(store, FakeProvider(), Clock.fixed(now, ZoneOffset.UTC), "fake")
        assertEquals(0, svc.executeDueOrders(user, now.toEpochMilli() + 10_000))
    }

    @Test
    fun unknownSideFills() {
        val store = mock<GameStore>()
        whenever(store.listOrders(user)).thenReturn(listOf(weirdOrder()))
        whenever(store.pendingOrders(user, now.toEpochMilli() + 10_000)).thenReturn(listOf(weirdOrder()))
        whenever(store.listTrades(user)).thenReturn(emptyList())
        whenever(store.getConfig(user)).thenReturn(
            stockgame.domain.GameConfig(10_000_000L, now.toEpochMilli() - 100_000, "fake"),
        )
        val svc = TradingService(store, FakeProvider(), Clock.fixed(now, ZoneOffset.UTC), "fake")
        assertEquals(0, svc.executeDueOrders(user, now.toEpochMilli() + 10_000))
    }

    @Test
    fun brokeBuySkipped() {
        val store = mock<GameStore>()
        val poor = stockgame.domain.GameConfig(100L, now.toEpochMilli() - 100_000, "fake")
        val buy = pendingOrder(id = 3, side = "buy", qty = 1000)
        stubDue(store, buy, emptyList(), poor)
        val svc = TradingService(store, FakeProvider(), Clock.fixed(now, ZoneOffset.UTC), "fake")
        assertEquals(0, svc.executeDueOrders(user, now.toEpochMilli() + 10_000))
        assertEquals("pending", store.listOrders(user)[0].status)
    }

    @Test
    fun brokeCoverSkipped() {
        val store = mock<GameStore>()
        val rich = stockgame.domain.GameConfig(
            100L,
            now.toEpochMilli() - 100_000,
            "fake",
            commissionCentsPerTrade = 50_000,
        )
        val cover = pendingOrder(id = 4, side = "cover", qty = 2)
        val short = stockgame.domain.Trade(
            id = 1,
            symbol = "AAPL",
            side = "short",
            qty = 2,
            price = 90.0,
            cashDeltaCents = -32_000L,
            mode = "backdated",
            executedAt = now.toEpochMilli() - 100_000,
            createdAt = now.toEpochMilli() - 100_000,
        )
        stubDue(store, cover, listOf(short), rich)
        val svc = TradingService(store, FakeProvider(), Clock.fixed(now, ZoneOffset.UTC), "fake")
        assertEquals(0, svc.executeDueOrders(user, now.toEpochMilli() + 10_000))
    }

    private fun pendingOrder(id: Long, side: String, qty: Int): stockgame.domain.Order =
        stockgame.domain.Order(
            id = id,
            symbol = "AAPL",
            side = side,
            qty = qty,
            executeAt = now.toEpochMilli(),
            status = "pending",
            createdAt = now.toEpochMilli(),
            tradeId = null,
            orderType = "market",
            tif = "GTC",
            limitPrice = null,
            stopPrice = null,
            expiresAt = null,
            fillPriceSource = "last",
        )

    private fun stubDue(
        store: GameStore,
        order: stockgame.domain.Order,
        trades: List<stockgame.domain.Trade>,
        config: stockgame.domain.GameConfig,
    ) {
        whenever(store.listOrders(user)).thenReturn(listOf(order))
        whenever(store.pendingOrders(user, now.toEpochMilli() + 10_000)).thenReturn(listOf(order))
        whenever(store.listTrades(user)).thenReturn(trades)
        whenever(store.getConfig(user)).thenReturn(config)
    }

    private fun weirdOrder(): stockgame.domain.Order = stockgame.domain.Order(
        id = 2,
        symbol = "AAPL",
        side = "weird",
        qty = 1,
        executeAt = now.toEpochMilli(),
        status = "pending",
        createdAt = now.toEpochMilli(),
        tradeId = null,
        orderType = "market",
        tif = "GTC",
        limitPrice = null,
        stopPrice = null,
        expiresAt = null,
        fillPriceSource = "last",
    )

    @Test
    fun sellFillsWithShares() {
        val bars = listOf(dayBar("2024-01-02", 100.0), dayBar("2024-01-03", 105.0))
        val store = FakeGameStore()
        val svc2 = TradingService(store, FakeProvider(bars), Clock.fixed(now, ZoneOffset.UTC), "fake")
        val start = java.time.Instant.parse("2024-01-01T00:00:00Z").toEpochMilli()
        svc2.updateConfig(user, 10_000_000, start, "fake", 15, 0)
        val day = java.time.Instant.parse("2024-01-02T00:00:00Z").toEpochMilli()
        svc2.placeBackdatedTrade(
            user,
            BackdatedRequest("AAPL", "buy", 10, day, "market", null, null),
        )
        svc2.placeOrder(
            user,
            OrderRequest("AAPL", "sell", 4, now.toEpochMilli() + 5_000, "market", "GTC", null, null, null),
        )
        assertEquals(1, svc2.executeDueOrders(user, now.toEpochMilli() + 10_000))
        assertEquals("filled", svc2.listOrders(user)[0].status)
    }
}
