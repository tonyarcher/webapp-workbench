package rssapi.ai

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

private class DecisionFakePoster(
    private val handler: (method: String, url: String, headers: Map<String, String>, body: String) -> HttpResult,
) : HttpPoster {
    val calls = mutableListOf<String>()
    var lastHeaders: Map<String, String> = emptyMap()
    var lastBody: String = ""
    override fun get(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult {
        calls.add("GET $url")
        lastHeaders = headers
        return handler("GET", url, headers, "")
    }
    override fun post(url: String, headers: Map<String, String>, body: String, timeoutMs: Long): HttpResult {
        calls.add("POST $url")
        lastHeaders = headers
        lastBody = body
        return handler("POST", url, headers, body)
    }
    override fun delete(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult {
        calls.add("DELETE $url")
        return handler("DELETE", url, headers, "")
    }
}

private fun decisionConfig() = AiConfig(provider = "decision", decisionApiKey = "test-key")

private fun failingDecisionPoster(error: Exception): DecisionFakePoster = DecisionFakePoster { _, _, _, _ ->
    throw error
}

private fun okJson(json: String) = HttpResult(200, json)

class DecisionBackendTest {
    @Test
    fun probeTrueOn2xxModels() {
        val poster = DecisionFakePoster { _, _, _, _ -> okJson("""{"models":["jev-latest"]}""") }
        assertTrue(DecisionBackend(decisionConfig(), poster).probe())
        assertEquals("GET https://api.typesafe.ai/v1/models", poster.calls.single())
        assertEquals("Bearer test-key", poster.lastHeaders["Authorization"])
    }

    @Test
    fun probeFalseOnNon2xx() {
        val poster = DecisionFakePoster { _, _, _, _ -> HttpResult(503, "busy") }
        assertFalse(DecisionBackend(decisionConfig(), poster).probe())
    }

    @Test
    fun probeFalseOnBlankKeyWithoutHttp() {
        val poster = DecisionFakePoster { _, _, _, _ -> throw AssertionError("probe must short-circuit without a key") }
        assertFalse(DecisionBackend(AiConfig(provider = "decision"), poster).probe())
        assertTrue(poster.calls.isEmpty())
    }

    @Test
    fun probeFalseOnMalformedJson() {
        val poster = DecisionFakePoster { _, _, _, _ -> okJson("not json{{{") }
        assertFalse(DecisionBackend(decisionConfig(), poster).probe())
    }

    @Test
    fun probeFalseOnTransportFailures() {
        val failures = listOf(AiException("down"), java.io.IOException("reset"), IllegalStateException("boom"))
        for (failure in failures) {
            assertFalse(DecisionBackend(decisionConfig(), failingDecisionPoster(failure)).probe())
        }
    }

    @Test
    fun scoreReturnsAnswersNode() {
        val poster = DecisionFakePoster { _, _, _, _ ->
            okJson(
                """{"model":"jev-latest","answers":{"a_worthy":{"type":"noul","noul":0.8}},
                    "usage":{"input_tokens":10,"output_tokens":5}}""",
            )
        }
        val questions = mapOf("a_worthy" to mapOf("type" to "noul", "instructions" to "Worthy?"))
        val answers = DecisionBackend(decisionConfig(), poster).score("""{"reader":{}}""", questions)
        assertEquals(0.8, answers.path("a_worthy").path("noul").asDouble())
        assertEquals("POST https://api.typesafe.ai/v1/systemone", poster.calls.single())
        assertEquals("Bearer test-key", poster.lastHeaders["Authorization"])
        assertEquals("application/json", poster.lastHeaders["Content-Type"])
        assertTrue(poster.lastBody.contains(""""model":"jev-latest""""))
        assertTrue(poster.lastBody.contains("a_worthy"))
    }

    @Test
    fun scoreRespectsBaseUrlAndModelOverride() {
        val poster = DecisionFakePoster { _, _, _, _ ->
            okJson("""{"model":"custom","answers":{},"usage":{"input_tokens":1,"output_tokens":1}}""")
        }
        val config =
            AiConfig(
                provider = "decision",
                baseUrl = "http://proxy:8080",
                decisionApiKey = "test-key",
                model = "custom",
            )
        DecisionBackend(config, poster).score("""{}""", emptyMap())
        assertEquals("POST http://proxy:8080/v1/systemone", poster.calls.single())
        assertTrue(poster.lastBody.contains(""""model":"custom""""))
    }

    @Test
    fun scoreErrorStatusesBecomeAiException() {
        for (status in listOf(401, 422, 429, 529)) {
            val poster = DecisionFakePoster { _, _, _, _ -> HttpResult(status, """{"error":"nope"}""") }
            val err = assertFailsWith<AiException> {
                DecisionBackend(decisionConfig(), poster).score("""{}""", emptyMap())
            }
            assertTrue(err.message!!.contains(status.toString()), "status $status in message")
        }
    }

    @Test
    fun scoreMissingAnswersFails() {
        val poster = DecisionFakePoster { _, _, _, _ ->
            okJson("""{"model":"jev-latest","usage":{"input_tokens":1,"output_tokens":1}}""")
        }
        assertFailsWith<AiException> { DecisionBackend(decisionConfig(), poster).score("""{}""", emptyMap()) }
    }

    @Test
    fun scoreMalformedBodiesFail() {
        val badState = DecisionFakePoster { _, _, _, _ -> throw AssertionError("bad state must fail before HTTP") }
        assertFailsWith<AiException> { DecisionBackend(decisionConfig(), badState).score("nope{{{", emptyMap()) }
        val badReply = DecisionFakePoster { _, _, _, _ -> okJson("nope{{{") }
        assertFailsWith<AiException> { DecisionBackend(decisionConfig(), badReply).score("""{}""", emptyMap()) }
    }
}
