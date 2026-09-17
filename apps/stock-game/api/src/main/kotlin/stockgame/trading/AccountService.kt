package stockgame.trading

import java.time.Clock
import java.util.UUID
import stockgame.domain.HoldingsEntry
import stockgame.provider.PriceProvider
import stockgame.store.GameStore

class AccountService(
    private val store: GameStore,
    private val provider: PriceProvider,
    private val clock: Clock,
    private val defaultProvider: String,
) {
    fun cashNowCents(userId: UUID): Long =
        cashUpTo(loadConfig(store, userId, defaultProvider), store.listTrades(userId), clock.millis())

    fun getHoldings(userId: UUID): List<HoldingsEntry> = holdings(store, provider, userId)

    fun heldQty(userId: UUID, symbol: String): Int = heldQty(store.listTrades(userId), symbol)
}
