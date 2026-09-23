package stockgame.provider

import com.fasterxml.jackson.databind.ObjectMapper
import stockgame.domain.ProviderError
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class YahooSearchBranchTest {
    private val mapper = ObjectMapper()

    @Test
    fun nonArrayThrows() {
        assertFailsWith<ProviderError> { parseYahooSearch(mapper.readTree("""{"quotes":{}}""")) }
        assertFailsWith<ProviderError> { parseYahooSearch(mapper.readTree("""{}""")) }
    }

    @Test
    fun skipsBlankSymbols() {
        val hits =
            parseYahooSearch(
                mapper.readTree("""{"quotes":[{"symbol":"","shortname":"X"},{"symbol":"AAPL"}]}"""),
            )
        assertEquals(1, hits.size)
        assertEquals("AAPL", hits[0].symbol)
        assertEquals("AAPL", hits[0].name)
        assertEquals("EQUITY", hits[0].type)
    }

    @Test
    fun longnameFallback() {
        val hits =
            parseYahooSearch(
                mapper.readTree(
                    """{"quotes":[{"symbol":"MSFT","longname":"Microsoft","exchange":"NMS","quoteType":"EQUITY"}]}""",
                ),
            )
        assertEquals("Microsoft", hits[0].name)
        assertEquals("NMS", hits[0].exchange)
        assertTrue(parseYahooSearch(mapper.readTree("""{"quotes":[]}""")).isEmpty())
    }
}
