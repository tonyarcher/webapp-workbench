package rssapi.ai

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

private class JevFakePoster(
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

private fun jevConfig() = AiConfig(provider = "jev", jevApiKey = "test-key")

private fun failingJevPoster(error: Exception): JevFakePoster = JevFakePoster { _, _, _, _ -> throw error }

private fun okJson(json: String) = HttpResult(200, json)

class JevBackendTest {
    @Test
    fun probeTrueOn2xxModels() {
        val poster = JevFakePoster { _, _, _, _ -> okJson("""{"models":["jev-latest"]}""") }
        assertTrue(JevBackend(jevConfig(), poster).probe())
        assertEquals("GET https://api.typesafe.ai/v1/models", poster.calls.single())
        assertEquals("Bearer test-key", poster.lastHeaders["Authorization"])
    }

    @Test
    fun probeFalseOnNon2xx() {
        val poster = JevFakePoster { _, _, _, _ -> HttpResult(503, "busy") }
        assertFalse(JevBackend(jevConfig(), poster).probe())
    }

    @Test
    fun probeFalseOnBlankKeyWithoutHttp() {
        val poster = JevFakePoster { _, _, _, _ -> throw AssertionError("probe must short-circuit without a key") }
        assertFalse(JevBackend(AiConfig(provider = "jev"), poster).probe())
        assertTrue(poster.calls.isEmpty())
    }

    @Test
    fun probeFalseOnMalformedJson() {
        val poster = JevFakePoster { _, _, _, _ -> okJson("not json{{{") }
        assertFalse(JevBackend(jevConfig(), poster).probe())
    }

    @Test
    fun probeFalseOnTransportFailures() {
        val failures = listOf(AiException("down"), java.io.IOException("reset"), IllegalStateException("boom"))
        for (failure in failures) {
            assertFalse(JevBackend(jevConfig(), failingJevPoster(failure)).probe())
        }
    }

    @Test
    fun scoreReturnsAnswersNode() {
        val poster = JevFakePoster { _, _, _, _ ->
            okJson(
                """{"model":"jev-latest","answers":{"a_worthy":{"type":"noul","noul":0.8}},
                    "usage":{"input_tokens":10,"output_tokens":5}}""",
            )
        }
        val questions = mapOf("a_worthy" to mapOf("type" to "noul", "instructions" to "Worthy?"))
        val answers = JevBackend(jevConfig(), poster).score("""{"reader":{}}""", questions)
        assertEquals(0.8, answers.path("a_worthy").path("noul").asDouble())
        assertEquals("POST https://api.typesafe.ai/v1/systemone", poster.calls.single())
        assertEquals("Bearer test-key", poster.lastHeaders["Authorization"])
        assertEquals("application/json", poster.lastHeaders["Content-Type"])
        assertTrue(poster.lastBody.contains(""""model":"jev-latest""""))
        assertTrue(poster.lastBody.contains("a_worthy"))
    }

    @Test
    fun scoreRespectsBaseUrlAndModelOverride() {
        val poster = JevFakePoster { _, _, _, _ ->
            okJson("""{"model":"custom","answers":{},"usage":{"input_tokens":1,"output_tokens":1}}""")
        }
        val config = AiConfig(provider = "jev", baseUrl = "http://proxy:8080", jevApiKey = "test-key", model = "custom")
        JevBackend(config, poster).score("""{}""", emptyMap())
        assertEquals("POST http://proxy:8080/v1/systemone", poster.calls.single())
        assertTrue(poster.lastBody.contains(""""model":"custom""""))
    }

    @Test
    fun scoreErrorStatusesBecomeAiException() {
        for (status in listOf(401, 422, 429, 529)) {
            val poster = JevFakePoster { _, _, _, _ -> HttpResult(status, """{"error":"nope"}""") }
            val err = assertFailsWith<AiException> {
                JevBackend(jevConfig(), poster).score("""{}""", emptyMap())
            }
            assertTrue(err.message!!.contains(status.toString()), "status $status in message")
        }
    }

    @Test
    fun scoreMissingAnswersFails() {
        val poster = JevFakePoster { _, _, _, _ ->
            okJson("""{"model":"jev-latest","usage":{"input_tokens":1,"output_tokens":1}}""")
        }
        assertFailsWith<AiException> { JevBackend(jevConfig(), poster).score("""{}""", emptyMap()) }
    }

    @Test
    fun scoreMalformedBodiesFail() {
        val badState = JevFakePoster { _, _, _, _ -> throw AssertionError("bad state must fail before HTTP") }
        assertFailsWith<AiException> { JevBackend(jevConfig(), badState).score("nope{{{", emptyMap()) }
        val badReply = JevFakePoster { _, _, _, _ -> okJson("nope{{{") }
        assertFailsWith<AiException> { JevBackend(jevConfig(), badReply).score("""{}""", emptyMap()) }
    }
}
