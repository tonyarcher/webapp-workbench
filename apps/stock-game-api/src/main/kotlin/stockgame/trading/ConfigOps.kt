package stockgame.trading

import stockgame.domain.GameConfig
import stockgame.store.GameStore

const val DEFAULT_CASH_CENTS = 10_000_000L

fun loadConfig(store: GameStore, defaultProvider: String): GameConfig {
    val existing = store.getConfig()
    if (existing != null) return existing
    val config = GameConfig(
        startingCashCents = DEFAULT_CASH_CENTS,
        startDate = System.currentTimeMillis(),
        provider = defaultProvider,
        quoteDelayMinutes = 15,
        commissionCentsPerTrade = 0,
    )
    store.saveConfig(config)
    return config
}

fun mergeConfig(
    current: GameConfig,
    startingCashCents: Long,
    startDate: Long,
    provider: String?,
    delay: Int?,
    commission: Int?,
): GameConfig {
    val next = GameConfig(
        startingCashCents = startingCashCents,
        startDate = startDate,
        provider = provider ?: current.provider,
        quoteDelayMinutes = delay ?: current.quoteDelayMinutes,
        commissionCentsPerTrade = commission ?: current.commissionCentsPerTrade,
    )
    return next
}
