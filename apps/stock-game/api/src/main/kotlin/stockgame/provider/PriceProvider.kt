package stockgame.provider

import stockgame.domain.Bar
import stockgame.domain.Quote
import stockgame.domain.SymbolHit

interface PriceProvider {
    val id: String
    fun getQuote(symbol: String): Quote
    fun getBars(symbol: String, interval: String, from: Long, to: Long): List<Bar>
    fun search(query: String): List<SymbolHit>
}
