package stockgame.provider

import com.fasterxml.jackson.databind.ObjectMapper
import kotlin.test.Test
import kotlin.test.assertEquals

class YahooParseExtraTest {
    private val mapper = ObjectMapper()

    private fun chart(meta: String, timestamps: String, quote: String): com.fasterxml.jackson.databind.JsonNode =
        mapper.readTree(
            """{"chart":{"result":[{"meta":{$meta},"timestamp":$timestamps,"indicators":{"quote":[$quote]}}]}}""",
        )

    @Test
    fun priceFallsBackToBars() {
        val json = chart(
            """"symbol":"AAPL"""",
            "[1705276800]",
            """{"close":[42.0]}""",
        )
        val quote = parseYahooQuote("AAPL", json, null)
        assertEquals(42.0, quote.price)
        assertEquals("AAPL", quote.name)
        assertEquals("USD", quote.currency)
        assertEquals("", quote.exchange)
    }

    @Test
    fun timeFallsBackToBars() {
        val json = chart(
            """"symbol":"AAPL","regularMarketPrice":10.0""",
            "[1705276800]",
            """{"close":[10.0]}""",
        )
        assertEquals(1705276800000, parseYahooQuote("AAPL", json, null).time)
    }

    @Test
    fun bookSingleSides() {
        val json = chart(
            """"symbol":"AAPL","regularMarketPrice":10.0,"regularMarketTime":1705339200""",
            "[1705276800]",
            """{"close":[10.0]}""",
        )
        val bidOnly = parseYahooQuote(
            "AAPL",
            json,
            mapper.readTree("""{"quoteResponse":{"result":[{"bid":9.0,"ask":0}]}}"""),
        )
        assertEquals(9.0, bidOnly.bid)
        val askOnly = parseYahooQuote(
            "AAPL",
            json,
            mapper.readTree("""{"quoteResponse":{"result":[{"ask":11.0}]}}"""),
        )
        assertEquals(11.0, askOnly.ask)
    }

    @Test
    fun fullExchangeName() {
        val json = chart(
            """"symbol":"AAPL","regularMarketPrice":10.0,"fullExchangeName":"NasdaqGS"""",
            "[1705276800]",
            """{"close":[10.0]}""",
        )
        assertEquals("NasdaqGS", parseYahooQuote("AAPL", json, null).exchange)
    }
}
