package stockgame.web

import org.springframework.beans.factory.ObjectProvider
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import stockgame.domain.GameConfig
import stockgame.trading.TradingService

data class UpdateConfigBody(
    val startingCashCents: Long,
    val startDate: Long,
    val provider: String? = null,
    val quoteDelayMinutes: Int? = null,
    val commissionCentsPerTrade: Int? = null,
)

@RestController
class ConfigController(private val trading: ObjectProvider<TradingService>) {
    @GetMapping("/config")
    fun get(): GameConfig = trading.orOffline().getConfig()

    @PutMapping("/config")
    fun put(@RequestBody body: UpdateConfigBody): GameConfig =
        trading.orOffline().updateConfig(
            body.startingCashCents,
            body.startDate,
            body.provider,
            body.quoteDelayMinutes,
            body.commissionCentsPerTrade,
        )
}
