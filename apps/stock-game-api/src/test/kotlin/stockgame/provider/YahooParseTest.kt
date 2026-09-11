package stockgame.provider

import com.fasterxml.jackson.databind.ObjectMapper
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import stockgame.domain.ProviderError

private val MAPPER = ObjectMapper()

private const val CHART = """
{"chart":{"result":[{
  "meta":{"currency":"USD","symbol":"AAPL","exchangeName":"NMS","shortName":"Apple Inc.",
    "regularMarketPrice":150.5,"regularMarketTime":1705339200},
  "timestamp":[1705276800,1705363200],
  "indicators":{"quote":[{
    "open":[149.0,150.0],"high":[151.0,152.0],"low":[148.5,149.5],
    "close":[150.0,151.0],"volume":[1000,2000]}]}
}],"error":null}}
"""

class YahooParseTest {
    @Test
    fun parsesQuoteAndBars() {
        val json = MAPPER.readTree(CHART)
        val quote = parseYahooQuote("AAPL", json, null)
        assertEquals("AAPL", quote.symbol)
        assertEquals(150.5, quote.price)
        assertEquals("Apple Inc.", quote.name)
        val bars = parseYahooBars(chartBlock(json))
        assertEquals(2, bars.size)
        assertEquals(1705276800000, bars[0].time)
        assertEquals(150.0, bars[0].close)
        assertEquals(2000, bars[1].volume)
    }

    @Test
    fun emptyResultThrows() {
        val json = MAPPER.readTree("""{"chart":{"result":[]}}""")
        assertFailsWith<ProviderError> { parseYahooQuote("AAPL", json, null) }
    }

    @Test
    fun parsesSearch() {
        val json = MAPPER.readTree(
            """{"quotes":[{"symbol":"AAPL","shortname":"Apple","exchange":"NMS","quoteType":"EQUITY"}]}""",
        )
        val hits = parseYahooSearch(json)
        assertEquals(1, hits.size)
        assertEquals("AAPL", hits[0].symbol)
        assertEquals("Apple", hits[0].name)
    }
}
