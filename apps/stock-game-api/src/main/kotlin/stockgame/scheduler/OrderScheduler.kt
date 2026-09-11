package stockgame.scheduler

import org.springframework.beans.factory.ObjectProvider
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import stockgame.log.log
import stockgame.trading.TradingService

@Component
class OrderScheduler(private val trading: ObjectProvider<TradingService>) {
    @Scheduled(initialDelay = 5_000, fixedDelay = 30_000)
    fun tick() {
        val svc = trading.ifAvailable ?: return
        runCatching { svc.executeDueOrders() }.onFailure { err ->
            log(
                "stock-game-api",
                "error",
                "scheduler tick",
                mapOf(
                    "err" to mapOf(
                        "type" to (err::class.simpleName ?: "Error"),
                        "message" to (err.message ?: ""),
                    ),
                ),
            )
        }
    }
}
