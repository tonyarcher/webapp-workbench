package fitnessapi.check

import fitnessapi.ai.AiConfig
import fitnessapi.ai.AiException
import fitnessapi.ai.DecisionBackend
import fitnessapi.ai.HttpPoster
import fitnessapi.ai.HttpResult
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

private class CheckFakePoster(private val handler: (String) -> HttpResult) : HttpPoster {
    val calls = mutableListOf<String>()
    var lastBody: String = ""
    override fun get(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult {
        calls.add("GET $url")
        throw AssertionError("plausibility scoring only POSTs")
    }

    override fun post(url: String, headers: Map<String, String>, body: String, timeoutMs: Long): HttpResult {
        calls.add("POST $url")
        lastBody = body
        return handler(body)
    }

    override fun delete(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult {
        calls.add("DELETE $url")
        throw AssertionError("plausibility scoring only POSTs")
    }
}

private fun posterOf(reply: String): CheckFakePoster = CheckFakePoster({ _: String -> HttpResult(200, reply) })

private fun providerOf(poster: CheckFakePoster): PlausibilityProvider =
    PlausibilityProvider(DecisionBackend(AiConfig(provider = "decision", decisionApiKey = "k"), poster))

private fun candidate(id: String): CheckCandidate =
    CheckCandidate(id = id, metric = "body_mass", valueSi = 82.0, latestValueSi = 81.0, avgSi = 81.5, historyN = 10)

private fun answers(vararg entries: String): String = """{"model":"jev-latest","answers":{${entries.joinToString(",")}},
       "usage":{"input_tokens":10,"output_tokens":5}}"""

private fun plausible(id: String, value: String): String = """"$id":{"type":"score","score":$value}"""

private fun review(id: String, value: String): String = """"$id":{"type":"noul","noul":$value}"""

class PlausibilityProviderTest {
    @Test
    fun emptyBatchSkipsHttp() {
        val poster = CheckFakePoster({ _: String -> throw AssertionError("no HTTP for an empty batch") })
        assertTrue(providerOf(poster).scoreBatch(emptyList()).isEmpty())
    }

    @Test
    fun mapsPlausibleAndReview() {
        val poster = posterOf(answers(plausible("s0_plausible", "1.8"), review("s0_review", "0.1")))
        val out = providerOf(poster).scoreBatch(listOf(candidate("s0")))
        assertEquals(0.9, out.getValue("s0").plausible, 1e-9)
        assertEquals(0.1, out.getValue("s0").review, 1e-9)
        assertTrue(poster.lastBody.contains("candidates[0].value"))
    }

    @Test
    fun clampsOutOfRangeAnswers() {
        val poster = posterOf(answers(plausible("s0_plausible", "5.0"), review("s0_review", "1.5")))
        val out = providerOf(poster).scoreBatch(listOf(candidate("s0")))
        assertEquals(1.0, out.getValue("s0").plausible)
        assertEquals(1.0, out.getValue("s0").review)
    }

    @Test
    fun partialAnswersFallBackPerSample() {
        val poster = posterOf(answers(plausible("s0_plausible", "1.0")))
        val out = providerOf(poster).scoreBatch(listOf(candidate("s0")))
        assertTrue(out.isEmpty())
    }

    @Test
    fun malformedAnswersFallBackPerSample() {
        val poster = posterOf(answers(plausible("s0_plausible", "1e999"), review("s0_review", "1e999")))
        val out = providerOf(poster).scoreBatch(listOf(candidate("s0")))
        assertTrue(out.isEmpty())
    }

    @Test
    fun capsBatchAtTwenty() {
        val reply = answers(
            *(0 until 20).flatMap { i ->
                listOf(plausible("s${i}_plausible", "1.0"), review("s${i}_review", "0.0"))
            }.toTypedArray(),
        )
        val poster = posterOf(reply)
        val many = (0 until 100).map { candidate("s$it") }
        val out = providerOf(poster).scoreBatch(many)
        assertEquals(20, out.size)
    }

    @Test
    fun listFailureThrowsForCallerFallback() {
        val poster = CheckFakePoster({ _: String -> throw AiException("down") })
        var threw = false
        try {
            providerOf(poster).scoreBatch(listOf(candidate("s0")))
        } catch (_: AiException) {
            threw = true
        }
        assertTrue(threw)
    }

    @Test
    fun verdictFlagsOnReviewOrLowPlausible() {
        assertTrue(verdictFor("s0", PlausibilityScores(0.9, 0.8)).flagged)
        assertTrue(verdictFor("s0", PlausibilityScores(0.2, 0.1)).flagged)
        assertFalse(verdictFor("s0", PlausibilityScores(0.9, 0.1)).flagged)
        assertEquals("code", verdictFor("s0", null).method)
        assertEquals("model", verdictFor("s0", PlausibilityScores(0.9, 0.1)).method)
    }
}
