package stockgame.provider

import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import stockgame.domain.Bar
import stockgame.domain.Quote
import stockgame.domain.SymbolHit

private const val YAHOO = "https://query1.finance.yahoo.com"
private const val UA = "Mozilla/5.0 (stock-game; like Gecko) stock-game"

class YahooProvider : PriceProvider {
    override val id: String = "yahoo"

    override fun getQuote(symbol: String): Quote {
        val enc = enc(symbol)
        val chart = fetchJson("$YAHOO/v8/finance/chart/$enc?interval=1d&range=1d", UA)
        val book = runCatching { fetchJson("$YAHOO/v7/finance/quote?symbols=$enc", UA) }.getOrNull()
        return parseYahooQuote(symbol, chart, book)
    }

    override fun getBars(symbol: String, interval: String, from: Long, to: Long): List<Bar> {
        val enc = enc(symbol)
        val p1 = from / 1000
        val p2 = to / 1000
        val url = "$YAHOO/v8/finance/chart/$enc?interval=$interval&period1=$p1&period2=$p2&events=div,splits"
        return parseYahooBars(chartBlock(fetchJson(url, UA)))
    }

    override fun search(query: String): List<SymbolHit> {
        val url = "$YAHOO/v1/finance/search?q=${enc(query)}&quotesCount=10&newsCount=0"
        return parseYahooSearch(fetchJson(url, UA))
    }
}

private fun enc(value: String): String = URLEncoder.encode(value, StandardCharsets.UTF_8)
