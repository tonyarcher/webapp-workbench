package stockgame.trading

import java.time.Clock
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
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
    private val inFlight = ConcurrentHashMap<UUID, AtomicBoolean>()

    fun getConfig(userId: UUID): GameConfig = loadConfig(store, userId, defaultProvider)

    fun updateConfig(
        userId: UUID,
        startingCashCents: Long,
        startDate: Long,
        provider: String?,
        delay: Int?,
        commission: Int?,
    ): GameConfig {
        val next = mergeConfig(getConfig(userId), startingCashCents, startDate, provider, delay, commission)
        store.saveConfig(userId, next)
        return next
    }

    fun listTrades(userId: UUID): List<Trade> = store.listTrades(userId)

    fun placeBackdatedTrade(userId: UUID, req: BackdatedRequest): Trade =
        placeBackdated(store, provider, defaultProvider, userId, req, clock.millis())

    fun placeOrder(userId: UUID, req: OrderRequest): Order =
        placeScheduled(store, defaultProvider, userId, req, clock.millis())

    fun listOrders(userId: UUID): List<Order> = store.listOrders(userId)

    fun cancelOrder(userId: UUID, orderId: Long) {
        store.cancelOrder(userId, orderId)
    }

    fun executeDueOrders(userId: UUID, now: Long = clock.millis()): Int {
        val flag = inFlight.computeIfAbsent(userId) { AtomicBoolean(false) }
        if (!flag.compareAndSet(false, true)) return 0
        return try {
            executeDue(store, provider, defaultProvider, userId, now)
        } finally {
            flag.set(false)
        }
    }
}
