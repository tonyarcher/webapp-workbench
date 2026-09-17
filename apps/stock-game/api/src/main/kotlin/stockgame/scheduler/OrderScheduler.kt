package stockgame.scheduler

import org.springframework.beans.factory.ObjectProvider
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import stockgame.log.log
import stockgame.store.GameStore
import stockgame.trading.TradingService

@Component
class OrderScheduler(
    private val trading: ObjectProvider<TradingService>,
    private val store: ObjectProvider<GameStore>,
) {
    @Scheduled(initialDelay = 5_000, fixedDelay = 30_000)
    fun tick() {
        val svc = trading.ifAvailable ?: return
        val game = store.ifAvailable ?: return
        for (userId in game.userIdsWithPendingOrders()) {
            runCatching { svc.executeDueOrders(userId) }.onFailure { err ->
                log(
                    "stock-game-api",
                    "error",
                    "scheduler tick",
                    mapOf(
                        "user_id" to userId.toString(),
                        "err" to mapOf(
                            "type" to (err::class.simpleName ?: "Error"),
                            "message" to (err.message ?: ""),
                        ),
                    ),
                )
            }
        }
    }
}
