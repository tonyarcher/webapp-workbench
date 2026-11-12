package calsync.match

import calsync.ai.AiConfig
import calsync.ai.AiException
import calsync.ai.DecisionBackend
import calsync.ai.HttpPoster
import calsync.ai.HttpResult
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

private class MatchFakePoster(private val handler: (String) -> HttpResult) : HttpPoster {
    val calls = mutableListOf<String>()
    var lastBody: String = ""
    override fun get(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult {
        calls.add("GET $url")
        throw AssertionError("match scoring only POSTs")
    }

    override fun post(url: String, headers: Map<String, String>, body: String, timeoutMs: Long): HttpResult {
        calls.add("POST $url")
        lastBody = body
        return handler(body)
    }

    override fun delete(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult {
        calls.add("DELETE $url")
        throw AssertionError("match scoring only POSTs")
    }
}

private fun posterOf(reply: String): MatchFakePoster = MatchFakePoster({ _: String -> HttpResult(200, reply) })

private fun providerOf(poster: MatchFakePoster): MatchProvider =
    MatchProvider(DecisionBackend(AiConfig(provider = "decision", decisionApiKey = "k"), poster))

class MatchProviderTest {
    @Test
    fun exactTitlesMatchWithoutHttp() {
        val poster = MatchFakePoster({ _: String -> throw AssertionError("exact matches skip HTTP") })
        val out = providerOf(poster).suggest(
            listOf(MatchEvent("t1", "Dune: Part Two (2024)")),
            listOf(MatchEvent("n1", "dune part two 2024")),
        )
        assertEquals(1, out.size)
        assertEquals("exact", out.single().method)
        assertTrue(poster.calls.isEmpty())
    }

    @Test
    fun modelMatchAboveThreshold() {
        val reply = """{"model":"jev-latest","answers":{"t1::n1":{"type":"noul","noul":0.9}}}"""
        val out = providerOf(posterOf(reply)).suggest(
            listOf(MatchEvent("t1", "Severance S02E03")),
            listOf(MatchEvent("n1", "Severance Season 2 Episode 3")),
        )
        assertEquals(1, out.size)
        assertEquals("model", out.single().method)
    }

    @Test
    fun lowModelScoreStaysUnmatched() {
        val reply = """{"model":"jev-latest","answers":{"t1::n1":{"type":"noul","noul":0.2}}}"""
        val out = providerOf(posterOf(reply)).suggest(
            listOf(MatchEvent("t1", "Andor")),
            listOf(MatchEvent("n1", "The Bear")),
        )
        assertTrue(out.isEmpty())
    }

    @Test
    fun listFailureKeepsExactMatches() {
        val poster = MatchFakePoster({ _: String -> throw AiException("down") })
        val out = providerOf(poster).suggest(
            listOf(MatchEvent("t1", "Dune"), MatchEvent("t2", "Andor")),
            listOf(MatchEvent("n1", "dune"), MatchEvent("n2", "The Bear")),
        )
        assertEquals(listOf("t1"), out.map { it.traktUid })
    }

    @Test
    fun normalizedTitleSkipsEmpty() {
        assertEquals("", normalizedTitle("!!!"))
    }

    @Test
    fun scoreBatchCapsAtTwentyAndSkipsMalformed() {
        val entries = (0 until 21).flatMap { i ->
            listOf(""""t$i::n$i":{"type":"noul","noul":0.9}""")
        }.joinToString(",")
        val reply = """{"model":"jev-latest","answers":{$entries}}"""
        val poster = posterOf(reply)
        val pairs = (0 until 21).map { i ->
            calsync.match.MatchPair("t$i::n$i", MatchEvent("t$i", "Show $i"), MatchEvent("n$i", "show $i"))
        }
        val out = providerOf(poster).scoreBatch(pairs)
        assertEquals(20, out.size)
    }

    @Test
    fun scoreBatchEmptySkipsHttp() {
        val poster = MatchFakePoster({ _: String -> throw AssertionError("no HTTP for an empty batch") })
        assertTrue(providerOf(poster).scoreBatch(emptyList()).isEmpty())
    }

    @Test
    fun emptyTitlesNeverMatchExactly() {
        val reply = """{"model":"jev-latest","answers":{"t1::n1":{"type":"noul","noul":0.1}}}"""
        val out = providerOf(posterOf(reply)).suggest(
            listOf(MatchEvent("t1", "!!!")),
            listOf(MatchEvent("n1", "???")),
        )
        assertTrue(out.isEmpty())
    }

    @Test
    fun malformedPairAnswersAreSkipped() {
        val reply = """{"model":"jev-latest","answers":{""" +
            """"a::b":{"type":"noul","noul":0.95},"c::d":{"type":"noul","noul":1e999}}}"""
        val poster = posterOf(reply)
        val out = providerOf(poster).scoreBatch(
            listOf(
                calsync.match.MatchPair("a::b", MatchEvent("a", "Dune"), MatchEvent("b", "dune")),
                calsync.match.MatchPair("c::d", MatchEvent("c", "Andor"), MatchEvent("d", "The Bear")),
            ),
        )
        assertEquals(1, out.size)
        assertEquals(0.95, out.getValue("a::b"), 1e-9)
    }

    @Test
    fun remainingPairsCapAtTwenty() {
        val trakt = (0 until 5).map { i -> MatchEvent("l$i", "Left Show Number $i Alpha") }
        val netflix = (0 until 5).map { i -> MatchEvent("r$i", "Right Show Number $i Beta") }
        val pairs = calsync.match.remainingPairs(trakt, netflix, emptySet(), emptySet())
        assertEquals(20, pairs.size)
        val entries = pairs.joinToString(",") { pair -> """"${pair.id}":{"type":"noul","noul":0.9}""" }
        val reply = """{"model":"jev-latest","answers":{$entries}}"""
        val out = providerOf(posterOf(reply)).suggest(trakt, netflix)
        assertEquals(20, out.size)
        assertTrue(out.all { it.method == "model" })
    }

    @Test
    fun remainingPairsCoverEveryTraktEvent() {
        val trakt = (0 until 3).map { i -> MatchEvent("l$i", "Left Show Number $i Alpha") }
        val netflix = listOf(MatchEvent("r0", "Right Show Number Zero Beta"))
        val pairs = calsync.match.remainingPairs(trakt, netflix, emptySet(), emptySet())
        assertEquals(setOf("l0", "l1", "l2"), pairs.map { it.trakt.uid }.toSet())
    }
}
