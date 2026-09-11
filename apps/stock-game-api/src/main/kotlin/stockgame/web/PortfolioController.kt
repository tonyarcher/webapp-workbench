package stockgame.web

import java.time.Clock
import org.springframework.beans.factory.ObjectProvider
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
import stockgame.domain.HoldingsEntry
import stockgame.domain.PortfolioSeries
import stockgame.provider.PriceProvider
import stockgame.trading.AccountService
import stockgame.trading.TradingService
import stockgame.trading.portfolioSeries

data class CashBody(val cashCents: Long)

@RestController
class PortfolioController(
    private val trading: ObjectProvider<TradingService>,
    private val accounts: ObjectProvider<AccountService>,
    private val provider: PriceProvider,
    private val clock: Clock,
) {
    @GetMapping("/holdings")
    fun holdings(): List<HoldingsEntry> = accounts.orOffline().getHoldings()

    @GetMapping("/cash")
    fun cash(): CashBody = CashBody(accounts.orOffline().cashNowCents())

    @GetMapping("/portfolio")
    fun series(): PortfolioSeries {
        val svc = trading.orOffline()
        return portfolioSeries(provider, svc.getConfig(), svc.listTrades(), clock.millis())
    }
}
