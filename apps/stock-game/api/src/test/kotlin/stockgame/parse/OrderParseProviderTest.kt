package stockgame.parse

import stockgame.ai.AiConfig
import stockgame.ai.AiException
import stockgame.ai.DecisionBackend
import stockgame.ai.HttpPoster
import stockgame.ai.HttpResult
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

private class ParseFakePoster(private val handler: (String) -> HttpResult) : HttpPoster {
    val calls = mutableListOf<String>()
    var lastBody: String = ""
    override fun get(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult {
        calls.add("GET $url")
        throw AssertionError("order parsing only POSTs")
    }

    override fun post(url: String, headers: Map<String, String>, body: String, timeoutMs: Long): HttpResult {
        calls.add("POST $url")
        lastBody = body
        return handler(body)
    }

    override fun delete(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult {
        calls.add("DELETE $url")
        throw AssertionError("order parsing only POSTs")
    }
}

private fun posterOf(reply: String): ParseFakePoster = ParseFakePoster({ _: String -> HttpResult(200, reply) })

private fun providerOf(poster: ParseFakePoster): OrderParseProvider =
    OrderParseProvider(DecisionBackend(AiConfig(provider = "decision", decisionApiKey = "k"), poster))

private fun answers(vararg entries: String): String = """{"model":"jev-latest","answers":{${entries.joinToString(",")}},
       "usage":{"input_tokens":10,"output_tokens":5}}"""

class OrderParseProviderTest {
    @Test
    fun parsesBuyOrder() {
        val reply = answers(
            """"intent":{"type":"noul","noul":0.95}""",
            """"side":{"type":"choice","choice":"buy"}""",
        )
        val out = providerOf(posterOf(reply)).parse("buy 10 AAPL")
        assertEquals(true, out.intent)
        assertEquals("buy", out.side)
        assertEquals("AAPL", out.symbol)
        assertEquals(10, out.qty)
        assertEquals("model", out.method)
    }

    @Test
    fun lowIntentStaysSuggestionOnly() {
        val reply = answers(
            """"intent":{"type":"noul","noul":0.2}""",
            """"side":{"type":"choice","choice":"unknown"}""",
        )
        val out = providerOf(posterOf(reply)).parse("what is AAPL worth")
        assertEquals(false, out.intent)
        assertEquals("unknown", out.side)
    }

    @Test
    fun missingSideFallsBackPerField() {
        val reply = answers(""""intent":{"type":"noul","noul":0.9}""")
        val out = providerOf(posterOf(reply)).parse("sell 5 TSLA")
        assertEquals(true, out.intent)
        assertEquals("unknown", out.side)
        assertEquals("model", out.method)
        assertEquals("TSLA", out.symbol)
        assertEquals(5, out.qty)
    }

    @Test
    fun malformedIntentFallsBackToCode() {
        val reply = answers(
            """"intent":{"type":"noul","noul":1e999}""",
            """"side":{"type":"choice","choice":"sell"}""",
        )
        val out = providerOf(posterOf(reply)).parse("sell 5 TSLA")
        assertEquals("code", out.method)
    }

    @Test
    fun listFailureFallsBackToCode() {
        val poster = ParseFakePoster({ _: String -> throw AiException("down") })
        val out = providerOf(poster).parse("buy 10 AAPL")
        assertEquals("code", out.method)
        assertEquals("AAPL", out.symbol)
    }

    @Test
    fun extractSlotsSkipsOrderWordsAndDecimals() {
        assertEquals("AAPL" to 10, extractSlots("buy 10 shares of AAPL"))
        assertEquals(null to null, extractSlots("what time is it"))
        assertEquals("TSLA" to null, extractSlots("sell TSLA at 10.5"))
        assertEquals(null to 7, extractSlots("buy 7"))
        assertEquals(null to 10, extractSlots("buy 10 aapl"))
        assertEquals("AAPL" to 10, extractSlots("I want to buy 10 AAPL"))
        assertEquals("IT" to 10, extractSlots("buy 10 IT"))
        assertEquals("BRK.B" to 10, extractSlots("buy 10 BRK.B"))
        assertEquals("AAPL" to 10, extractSlots("PLEASE BUY 10 AAPL"))
        assertEquals("AAPL" to 10, extractSlots("I WANT TO BUY 10 AAPL"))
        assertEquals("AAPL" to 10, extractSlots("WANT 10 AAPL"))
        assertEquals("TSLA" to null, extractSlots("sell TSLA NOW"))
        assertNull(extractSlots("What is IT worth in 2026?").first)
        assertNull(extractSlots("what is the U.S. market doing").first)
        assertEquals(null to 10, extractSlots("buy at 10 AM"))
    }

    @Test
    fun unknownSideChoiceMapsToUnknown() {
        val reply = answers(
            """"intent":{"type":"noul","noul":0.9}""",
            """"side":{"type":"choice","choice":"gossip"}""",
        )
        val out = providerOf(posterOf(reply)).parse("buy 10 AAPL")
        assertEquals("unknown", out.side)
        assertEquals(true, out.intent)
    }
}
