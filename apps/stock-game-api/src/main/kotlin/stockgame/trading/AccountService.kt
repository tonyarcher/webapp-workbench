package stockgame.trading

import java.time.Clock
import stockgame.domain.HoldingsEntry
import stockgame.provider.PriceProvider
import stockgame.store.GameStore

class AccountService(
    private val store: GameStore,
    private val provider: PriceProvider,
    private val clock: Clock,
    private val defaultProvider: String,
) {
    fun cashNowCents(): Long = cashUpTo(loadConfig(store, defaultProvider), store.listTrades(), clock.millis())

    fun getHoldings(): List<HoldingsEntry> = holdings(store, provider)

    fun heldQty(symbol: String): Int = heldQty(store.listTrades(), symbol)
}
