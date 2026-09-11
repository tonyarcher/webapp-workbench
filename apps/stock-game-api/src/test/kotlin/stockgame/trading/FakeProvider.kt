package stockgame.trading

import stockgame.domain.Bar
import stockgame.domain.Quote
import stockgame.domain.SymbolHit
import stockgame.provider.PriceProvider

class FakeProvider(
    private val bars: List<Bar> = emptyList(),
    private val quote: Quote? = null,
) : PriceProvider {
    override val id: String = "fake"

    override fun getQuote(symbol: String): Quote =
        quote ?: Quote(symbol, symbol, 50.0, "USD", "TEST", 0, 0)

    override fun getBars(symbol: String, interval: String, from: Long, to: Long): List<Bar> =
        bars.filter { it.time in from..to }

    override fun search(query: String): List<SymbolHit> = emptyList()
}

fun dayBar(date: String, close: Double, low: Double = close, high: Double = close): Bar {
    val time = java.time.Instant.parse("${date}T14:30:00Z").toEpochMilli()
    return Bar(time, close, high, low, close, 1000)
}
