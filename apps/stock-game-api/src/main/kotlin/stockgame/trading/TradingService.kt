package stockgame.trading

import java.time.Clock
import java.util.concurrent.atomic.AtomicBoolean
import stockgame.domain.GameConfig
import stockgame.domain.Order
import stockgame.domain.Trade
import stockgame.provider.PriceProvider
import stockgame.store.GameStore

class TradingService(
    private val store: GameStore,
    private val provider: PriceProvider,
    private val clock: Clock,
    private val defaultProvider: String,
) {
    private val inFlight = AtomicBoolean(false)

    fun getConfig(): GameConfig = loadConfig(store, defaultProvider)

    fun updateConfig(
        startingCashCents: Long,
        startDate: Long,
        provider: String?,
        delay: Int?,
        commission: Int?,
    ): GameConfig {
        val next = mergeConfig(getConfig(), startingCashCents, startDate, provider, delay, commission)
        store.saveConfig(next)
        return next
    }

    fun listTrades(): List<Trade> = store.listTrades()

    fun placeBackdatedTrade(req: BackdatedRequest): Trade =
        placeBackdated(store, provider, defaultProvider, req, clock.millis())

    fun placeOrder(req: OrderRequest): Order = placeScheduled(store, defaultProvider, req, clock.millis())

    fun listOrders(): List<Order> = store.listOrders()

    fun cancelOrder(orderId: Long) {
        store.cancelOrder(orderId)
    }

    fun executeDueOrders(now: Long = clock.millis()): Int {
        if (!inFlight.compareAndSet(false, true)) return 0
        return try {
            executeDue(store, provider, defaultProvider, now)
        } finally {
            inFlight.set(false)
        }
    }
}
