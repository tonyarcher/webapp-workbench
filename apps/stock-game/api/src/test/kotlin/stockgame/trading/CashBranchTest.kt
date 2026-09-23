package stockgame.trading

import stockgame.domain.GameConfig
import stockgame.domain.Trade
import stockgame.domain.TradingError
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class CashBranchTest {
    private val uid = UUID.randomUUID()
    private val config = GameConfig(1_000_000L, 0L, "fake")

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

    @Test
    fun cashSkipsFuture() {
        val trades = listOf(trade("A", "buy", 1, 100L, -100L), trade("A", "buy", 1, 200L, -100L))
        assertEquals(1_000_000L - 100L, cashUpTo(config, trades, 150L))
        assertEquals(1_000_000L - 200L, cashUpTo(config, trades, 300L))
    }

    @Test
    fun heldFilters() {
        val trades =
            listOf(
                trade("A", "buy", 5, 100L, -50L),
                trade("B", "buy", 3, 100L, -30L),
                trade("A", "sell", 2, 300L, 20L),
            )
        assertEquals(5, heldQtyUpTo(trades, "A", 200L))
        assertEquals(3, heldQtyUpTo(trades, "A", 400L))
        assertEquals(0, heldQtyUpTo(trades, "Z", 400L))
        assertEquals(3, heldQty(trades, "A"))
    }

    @Test
    fun guards() {
        val trades = listOf(trade("A", "buy", 5, 100L, -50L))
        requireBuyCash(config, trades, 200L, -100L)
        assertFailsWith<TradingError> { requireBuyCash(config, trades, 200L, -2_000_000L) }
        requireSellShares(trades, "A", 200L, 5)
        assertFailsWith<TradingError> { requireSellShares(trades, "A", 200L, 6) }
        assertFailsWith<TradingError> { requireSellShares(trades, "A", 50L, 1) }
    }

    @Test
    fun coverGuards() {
        val short = listOf(trade("A", "short", 5, 100L, 50L))
        requireCover(config, short, "A", 200L, 5, -10L)
        assertFailsWith<TradingError> { requireCover(config, short, "A", 200L, 6, -10L) }
        assertFailsWith<TradingError> { requireCover(config, short, "A", 200L, 5, -2_000_000L) }
    }
}
