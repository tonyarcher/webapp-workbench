package stockgame.trading

import stockgame.domain.TradingError
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class OrderRequestBranchTest {
    private val store = FakeGameStore()
    private val user = UUID.randomUUID()

    @Test
    fun asapWhenNull() {
        store.saveConfig(user, stockgame.domain.GameConfig(1_000_000L, 0L, "fake"))
        val order =
            placeScheduled(
                store,
                "fake",
                user,
                OrderRequest("AAPL", "buy", 1, null, "market", "GTC", null, null, null),
                1_700_000_000_000L,
            )
        assertEquals("pending", order.status)
    }

    @Test
    fun pastExecutionRejected() {
        store.saveConfig(user, stockgame.domain.GameConfig(1_000_000L, 0L, "fake"))
        assertFailsWith<TradingError> {
            placeScheduled(
                store,
                "fake",
                user,
                OrderRequest("AAPL", "buy", 1, 100L, "market", "GTC", null, null, null),
                1_700_000_000_000L,
            )
        }
    }

    @Test
    fun dayExpirySet() {
        store.saveConfig(user, stockgame.domain.GameConfig(1_000_000L, 0L, "fake"))
        val order =
            placeScheduled(
                store,
                "fake",
                user,
                OrderRequest("AAPL", "buy", 1, 1_800_000_000_000L, "market", "DAY", null, null, null),
                1_700_000_000_000L,
            )
        assertEquals(true, order.expiresAt != null)
        val gtc =
            placeScheduled(
                store,
                "fake",
                user,
                OrderRequest("AAPL", "buy", 1, 1_800_000_000_001L, "market", "GTC", null, null, null),
                1_700_000_000_000L,
            )
        assertEquals(null, gtc.expiresAt)
    }
}
