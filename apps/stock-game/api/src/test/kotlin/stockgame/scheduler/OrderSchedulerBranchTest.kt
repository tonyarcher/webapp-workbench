package stockgame.scheduler

import java.time.Clock
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.ObjectProvider
import stockgame.store.GameStore
import stockgame.trading.FakeGameStore
import stockgame.trading.FakeProvider
import stockgame.trading.TradingService

class OrderSchedulerBranchTest {
    private fun providers(
        svc: TradingService?,
        store: GameStore?,
    ): Pair<ObjectProvider<TradingService>, ObjectProvider<GameStore>> {
        val trading = mock<ObjectProvider<TradingService>>()
        val games = mock<ObjectProvider<GameStore>>()
        whenever(trading.ifAvailable).thenReturn(svc)
        whenever(games.ifAvailable).thenReturn(store)
        return trading to games
    }

    private fun realService(store: GameStore): TradingService =
        TradingService(store, FakeProvider(), Clock.systemUTC(), "fake")

    @Test
    fun skipsWhenOffline() {
        val (trading, games) = providers(null, null)
        OrderScheduler(trading, games).tick()
        verify(games, never()).ifAvailable
    }

    @Test
    fun skipsWhenNoStore() {
        val (trading, games) = providers(realService(FakeGameStore()), null)
        OrderScheduler(trading, games).tick()
        verify(games).ifAvailable
    }

    @Test
    fun executesPending() {
        val fixed = Clock.fixed(java.time.Instant.parse("2026-01-01T00:00:00Z"), java.time.ZoneOffset.UTC)
        val store = FakeGameStore()
        val svc = TradingService(store, FakeProvider(), fixed, "fake")
        val uid = UUID.randomUUID()
        svc.updateConfig(uid, 1_000_000L, 1_700_000_000_000L, null, null, null)
        svc.placeOrder(
            uid,
            stockgame.trading.OrderRequest(
                symbol = "AAPL",
                side = "buy",
                qty = 1,
                executeAt = fixed.millis() + 60_000L,
                orderType = "market",
                tif = "GTC",
                limitPrice = null,
                stopPrice = null,
                fillPriceSource = null,
            ),
        )
        assertEquals(listOf(uid), store.userIdsWithPendingOrders())
        val (trading, games) = providers(svc, store)
        OrderScheduler(trading, games).tick()
        assertEquals(1, store.listOrders(uid).size)
    }

    @Test
    fun logsFailure() {
        val store = mock<GameStore>()
        val uid = UUID.randomUUID()
        whenever(store.userIdsWithPendingOrders()).thenReturn(listOf(uid))
        whenever(store.listOrders(uid)).thenThrow(IllegalStateException("down"))
        val svc = realService(store)
        val (trading, games) = providers(svc, store)
        OrderScheduler(trading, games).tick()
        verify(store).listOrders(uid)
    }

    @Test
    fun anonymousFailureLogged() {
        val store = mock<GameStore>()
        val uid = UUID.randomUUID()
        whenever(store.userIdsWithPendingOrders()).thenReturn(listOf(uid))
        whenever(store.listOrders(uid)).thenThrow(object : IllegalStateException() {})
        val svc = realService(store)
        val (trading, games) = providers(svc, store)
        OrderScheduler(trading, games).tick()
        verify(store).listOrders(uid)
    }

    @Test
    fun emptyPending() {
        val store = FakeGameStore()
        val svc = realService(store)
        val (trading, games) = providers(svc, store)
        OrderScheduler(trading, games).tick()
        assertEquals(emptyList(), store.userIdsWithPendingOrders())
    }
}
