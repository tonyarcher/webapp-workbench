package stockgame.provider

import com.fasterxml.jackson.databind.ObjectMapper
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue
import stockgame.domain.ProviderError

private val BRANCH_MAPPER = ObjectMapper()

private const val BRANCH_CHART = """
{"chart":{"result":[{
  "meta":{"currency":"USD","symbol":"AAPL","exchangeName":"NMS","shortName":"Apple Inc.",
    "regularMarketPrice":150.5,"regularMarketTime":1705339200},
  "timestamp":[1705276800,1705363200],
  "indicators":{"quote":[{
    "open":[149.0,150.0],"high":[151.0,152.0],"low":[148.5,149.5],
    "close":[150.0,151.0],"volume":[1000,2000]}]}
}],"error":null}}
"""

class YahooParseBranchTest {
    @Test
    fun missingNodesReturnEmpty() {
        assertEquals(emptyList(), parseYahooBars(BRANCH_MAPPER.readTree("""{"x":1}""")))
        assertFailsWith<ProviderError> {
            parseYahooQuote("AAPL", BRANCH_MAPPER.readTree("""{"chart":{}}"""), null)
        }
    }

    @Test
    fun skipsBadRows() {
        val row = """[1,"x"]"""
        val quote = """{"open":$row,"high":$row,"low":$row,"close":$row,"volume":$row}"""
        val json = BRANCH_MAPPER.readTree(
            """{"timestamp":[1,"x"],"indicators":{"quote":[$quote]}}""",
        )
        val bars = parseYahooBars(json)
        assertEquals(1, bars.size)
    }

    @Test
    fun fillsMissingOhlcFromClose() {
        val json = BRANCH_MAPPER.readTree(
            """{"timestamp":[10],"indicators":{"quote":[{"close":[5.0]}]}}""",
        )
        val bars = parseYahooBars(json)
        assertEquals(1, bars.size)
        assertEquals(5.0, bars[0].open)
        assertEquals(0, bars[0].volume)
    }

    @Test
    fun nonFiniteFiltered() {
        val json = BRANCH_MAPPER.readTree(
            """{"timestamp":[10],"indicators":{"quote":[{"close":[1e400]}]}}""",
        )
        assertTrue(parseYahooBars(json).isEmpty())
    }

    @Test
    fun bookMergesBidAsk() {
        val chart = BRANCH_MAPPER.readTree(BRANCH_CHART)
        val book = BRANCH_MAPPER.readTree(
            """{"quoteResponse":{"result":[{"bid":149.0,"ask":151.0}]}}""",
        )
        val quote = parseYahooQuote("AAPL", chart, book)
        assertEquals(149.0, quote.bid)
        assertEquals(151.0, quote.ask)
        val empty = parseYahooQuote("AAPL", chart, BRANCH_MAPPER.readTree("""{"quoteResponse":{}}"""))
        assertNull(empty.bid)
        val nobid = parseYahooQuote(
            "AAPL",
            chart,
            BRANCH_MAPPER.readTree("""{"quoteResponse":{"result":[{}]}}"""),
        )
        assertNull(nobid.ask)
    }

    @Test
    fun longNameFallback() {
        val meta = """{"symbol":"AAPL","longName":"Apple Incorporated","regularMarketPrice":1.0}"""
        val body = """"timestamp":[1],"indicators":{"quote":[{"close":[1.0]}]}"""
        val chart = BRANCH_MAPPER.readTree(
            """{"chart":{"result":[{"meta":$meta,$body}]}}""",
        )
        assertEquals("Apple Incorporated", parseYahooQuote("AAPL", chart, null).name)
    }

    @Test
    fun noPriceThrows() {
        val chart = BRANCH_MAPPER.readTree(
            """{"chart":{"result":[{"meta":{"symbol":"AAPL"},"timestamp":[],"indicators":{"quote":[{}]}}]}}""",
        )
        assertFailsWith<ProviderError> { parseYahooQuote("AAPL", chart, null) }
    }

    @Test
    fun timestampsWithoutIndicators() {
        val json = BRANCH_MAPPER.readTree("""{"timestamp":[1]}""")
        assertTrue(parseYahooBars(json).isEmpty())
    }

    @Test
    fun nonNumericTimeSkipped() {
        val json = BRANCH_MAPPER.readTree(
            """{"timestamp":["x"],"indicators":{"quote":[{"close":[1.0]}]}}""",
        )
        assertTrue(parseYahooBars(json).isEmpty())
    }

    @Test
    fun zeroBidAskIgnored() {
        val chart = BRANCH_MAPPER.readTree(BRANCH_CHART)
        val book = BRANCH_MAPPER.readTree("""{"quoteResponse":{"result":[{"bid":0,"ask":0}]}}""")
        val quote = parseYahooQuote("AAPL", chart, book)
        assertNull(quote.bid)
        assertNull(quote.ask)
    }

    @Test
    fun priceWithoutTimeUsesClock() {
        val meta = """"symbol":"AAPL","regularMarketPrice":9.0"""
        val body = """"timestamp":[],"indicators":{"quote":[{}]}"""
        val chart = BRANCH_MAPPER.readTree(
            """{"chart":{"result":[{"meta":{$meta},$body}]}}""",
        )
        val quote = parseYahooQuote("AAPL", chart, null)
        assertEquals(9.0, quote.price)
        assertTrue(quote.time > 0)
    }
}
