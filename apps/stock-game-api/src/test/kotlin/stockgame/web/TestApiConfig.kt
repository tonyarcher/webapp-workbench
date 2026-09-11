package stockgame.web

import java.time.Clock
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Primary
import stockgame.provider.PriceProvider
import stockgame.store.GameStore
import stockgame.trading.AccountService
import stockgame.trading.FakeGameStore
import stockgame.trading.FakeProvider
import stockgame.trading.TradingService

@TestConfiguration
class TestApiConfig {
    @Bean
    @Primary
    fun clock(): Clock = Clock.systemUTC()

    @Bean
    @Primary
    fun priceProvider(): PriceProvider = FakeProvider()

    @Bean
    @Primary
    fun gameStore(): GameStore = FakeGameStore()

    @Bean
    @Primary
    fun tradingService(store: GameStore, provider: PriceProvider, clock: Clock): TradingService =
        TradingService(store, provider, clock, "fake")

    @Bean
    @Primary
    fun accountService(store: GameStore, provider: PriceProvider, clock: Clock): AccountService =
        AccountService(store, provider, clock, "fake")
}
