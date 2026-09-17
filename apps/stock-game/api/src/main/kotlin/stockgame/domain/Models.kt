package stockgame.domain

data class Bar(
    val time: Long,
    val open: Double,
    val high: Double,
    val low: Double,
    val close: Double,
    val volume: Long,
)

data class Quote(
    val symbol: String,
    val name: String,
    val price: Double,
    val currency: String,
    val exchange: String,
    val time: Long,
    val delayMinutes: Int = 15,
    val bid: Double? = null,
    val ask: Double? = null,
)

data class SymbolHit(
    val symbol: String,
    val name: String,
    val exchange: String,
    val type: String,
)

data class GameConfig(
    val startingCashCents: Long,
    val startDate: Long,
    val provider: String,
    val quoteDelayMinutes: Int = 15,
    val commissionCentsPerTrade: Int = 0,
)

data class Trade(
    val id: Long,
    val symbol: String,
    val side: String,
    val qty: Int,
    val price: Double,
    val cashDeltaCents: Long,
    val mode: String,
    val executedAt: Long,
    val createdAt: Long,
)

data class Order(
    val id: Long,
    val symbol: String,
    val side: String,
    val qty: Int,
    val executeAt: Long,
    val status: String,
    val createdAt: Long,
    val tradeId: Long?,
    val orderType: String,
    val tif: String,
    val limitPrice: Double?,
    val stopPrice: Double?,
    val expiresAt: Long?,
    val fillPriceSource: String,
)

data class HoldingsEntry(
    val symbol: String,
    val name: String,
    val qty: Int,
    val avgCostCents: Long,
    val costBasisCents: Long,
    val currentPrice: Double,
    val marketValueCents: Long,
    val unrealizedPnlCents: Long,
    val unrealizedPnlPct: Double,
)

data class PortfolioPoint(
    val time: Long,
    val cashCents: Long,
    val holdingsCents: Long,
    val totalCents: Long,
    val gainCents: Long,
)

data class PortfolioSeries(
    val startingCashCents: Long,
    val startDate: Long,
    val endDate: Long,
    val totalReturnPct: Double,
    val points: List<PortfolioPoint>,
    val totalGainCents: Long,
)

class TradingError(message: String) : RuntimeException(message)

class ProviderError(message: String) : RuntimeException(message)
