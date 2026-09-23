package stockgame.web

import org.springframework.beans.factory.ObjectProvider
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
import stockgame.domain.HoldingsEntry
import stockgame.domain.PortfolioSeries
import stockgame.provider.PriceProvider
import stockgame.trading.AccountService
import stockgame.trading.TradingService
import stockgame.trading.portfolioSeries
import java.time.Clock

data class CashBody(val cashCents: Long)

@RestController
class PortfolioController(
    private val user: IdentityUser,
    private val trading: ObjectProvider<TradingService>,
    private val accounts: ObjectProvider<AccountService>,
    private val provider: PriceProvider,
    private val clock: Clock,
) {
    @GetMapping("/holdings", headers = ["X-Api-Version=1"])
    fun holdings(): List<HoldingsEntry> = accounts.orOffline().getHoldings(user.id)

    @GetMapping("/cash", headers = ["X-Api-Version=1"])
    fun cash(): CashBody = CashBody(accounts.orOffline().cashNowCents(user.id))

    @GetMapping("/portfolio", headers = ["X-Api-Version=1"])
    fun series(): PortfolioSeries {
        val svc = trading.orOffline()
        val uid = user.id
        return portfolioSeries(provider, svc.getConfig(uid), svc.listTrades(uid), clock.millis())
    }
}
