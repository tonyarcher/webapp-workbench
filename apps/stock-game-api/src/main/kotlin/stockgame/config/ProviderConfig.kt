package stockgame.config

import java.time.Clock
import org.springframework.beans.factory.ObjectProvider
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import stockgame.domain.ProviderError
import stockgame.provider.CachedProvider
import stockgame.provider.PriceProvider
import stockgame.provider.YahooProvider
import stockgame.settingsFromEnv
import stockgame.store.BarCache
import stockgame.store.GameStore
import stockgame.trading.AccountService
import stockgame.trading.TradingService

@Configuration
class ProviderConfig {
    @Bean
    fun priceProvider(cache: ObjectProvider<BarCache>): PriceProvider {
        val settings = settingsFromEnv(System.getenv())
        val raw = when (settings.provider) {
            "yahoo" -> YahooProvider()
            else -> throw ProviderError("Unknown PRICE_PROVIDER: ${settings.provider}")
        }
        val bars = cache.ifAvailable ?: return raw
        return CachedProvider(raw, bars, settings.quoteTtlMs)
    }

    @Bean
    @ConditionalOnBean(GameStore::class)
    fun tradingService(store: GameStore, provider: PriceProvider, clock: Clock): TradingService {
        val settings = settingsFromEnv(System.getenv())
        return TradingService(store, provider, clock, settings.provider)
    }

    @Bean
    @ConditionalOnBean(GameStore::class)
    fun accountService(store: GameStore, provider: PriceProvider, clock: Clock): AccountService {
        val settings = settingsFromEnv(System.getenv())
        return AccountService(store, provider, clock, settings.provider)
    }
}
