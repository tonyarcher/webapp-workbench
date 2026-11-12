package stockgame.ai

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

private class FakePoster(private val handler: (String) -> HttpResult) : HttpPoster {
    val calls = mutableListOf<String>()
    var lastBody: String = ""
    override fun get(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult {
        calls.add("GET $url")
        return handler("")
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

private fun okJson(body: String): HttpResult = HttpResult(200, body)

class DecisionBackendTest {
    @Test
    fun probeShortCircuitsWithoutKey() {
        val poster = FakePoster({ _: String -> throw AssertionError("no HTTP without a key") })
        assertFalse(DecisionBackend(AiConfig(provider = "decision"), poster).probe())
        assertTrue(poster.calls.isEmpty())
    }

    @Test
    fun probeTrueOnModels() {
        val poster = FakePoster({ _: String -> okJson("""{"models":["jev-latest"]}""") })
        assertEquals(true, DecisionBackend(AiConfig(provider = "decision", decisionApiKey = "k"), poster).probe())
    }

    @Test
    fun probeFalseOnNon2xx() {
        val poster = FakePoster({ _: String -> HttpResult(500, "bad") })
        assertEquals(false, DecisionBackend(AiConfig(provider = "decision", decisionApiKey = "k"), poster).probe())
    }

    @Test
    fun probeFalseBelowRange() {
        val poster = FakePoster({ _: String -> HttpResult(150, "early") })
        assertEquals(false, DecisionBackend(AiConfig(provider = "decision", decisionApiKey = "k"), poster).probe())
    }

    @Test
    fun probeFalseOnBadJson() {
        val poster = FakePoster({ _: String -> okJson("not-json") })
        assertEquals(false, DecisionBackend(AiConfig(provider = "decision", decisionApiKey = "k"), poster).probe())
    }

    @Test
    fun probeFalseOnTransportFailure() {
        val poster = FakePoster({ _: String -> throw AiException("down") })
        assertEquals(false, DecisionBackend(AiConfig(provider = "decision", decisionApiKey = "k"), poster).probe())
    }

    @Test
    fun scoreReturnsAnswers() {
        val poster =
            FakePoster({ _: String -> okJson("""{"model":"jev-latest","answers":{"a":{"type":"noul","noul":0.9}}}""") })
        val backend = DecisionBackend(AiConfig(provider = "decision", decisionApiKey = "k"), poster)
        val answers = backend.score("""{"request":"buy 10 AAPL"}""", mapOf("a" to mapOf("type" to "noul")))
        assertEquals(0.9, answers.path("a").path("noul").asDouble(), 1e-9)
        assertEquals("POST https://api.typesafe.ai/v1/systemone", poster.calls.single())
    }

    @Test
    fun scoreThrowsOnNon2xx() {
        val poster = FakePoster({ _: String -> HttpResult(500, "bad") })
        var threw = false
        try {
            DecisionBackend(AiConfig(provider = "decision", decisionApiKey = "k"), poster)
                .score("""{"request":"x"}""", mapOf("a" to mapOf("type" to "noul")))
        } catch (_: AiException) {
            threw = true
        }
        assertTrue(threw)
    }

    @Test
    fun scoreThrowsOnMissingAnswers() {
        val poster = FakePoster({ _: String -> okJson("""{"model":"jev-latest"}""") })
        var threw = false
        try {
            DecisionBackend(AiConfig(provider = "decision", decisionApiKey = "k"), poster)
                .score("""{"request":"x"}""", mapOf("a" to mapOf("type" to "noul")))
        } catch (_: AiException) {
            threw = true
        }
        assertTrue(threw)
    }

    @Test
    fun customBaseAndModelOverrideDefaults() {
        val poster =
            FakePoster({ _: String -> okJson("""{"model":"custom","answers":{"a":{"type":"noul","noul":0.9}}}""") })
        val backend = DecisionBackend(
            AiConfig(provider = "decision", decisionApiKey = "k", baseUrl = "https://host", model = "custom"),
            poster,
        )
        backend.score("""{"request":"x"}""", mapOf("a" to mapOf("type" to "noul")))
        assertEquals("POST https://host/v1/systemone", poster.calls.single())
        assertTrue(poster.lastBody.contains("custom"))
    }

    @Test
    fun httpBaseScoreThrows() {
        val poster = FakePoster({ _: String -> throw AssertionError("no HTTP to an http base") })
        var threw = false
        try {
            DecisionBackend(
                AiConfig(provider = "decision", decisionApiKey = "k", baseUrl = "http://example.com"),
                poster,
            ).score("""{"request":"x"}""", mapOf("a" to mapOf("type" to "noul")))
        } catch (_: AiException) {
            threw = true
        }
        assertTrue(threw)
        assertTrue(poster.calls.isEmpty())
    }

    @Test
    fun httpBaseProbeIsFalse() {
        val poster = FakePoster({ _: String -> throw AssertionError("no HTTP to an http base") })
        val backend = DecisionBackend(
            AiConfig(provider = "decision", decisionApiKey = "k", baseUrl = "http://example.com"),
            poster,
        )
        assertEquals(false, backend.probe())
    }

    @Test
    fun localHttpBaseIsAllowed() {
        val poster =
            FakePoster({ _: String -> okJson("""{"model":"jev-latest","answers":{"a":{"type":"noul","noul":0.9}}}""") })
        val loopback = DecisionBackend(
            AiConfig(provider = "decision", decisionApiKey = "k", baseUrl = "http://localhost:8080"),
            poster,
        )
        loopback.score("""{"request":"x"}""", mapOf("a" to mapOf("type" to "noul")))
        assertEquals("POST http://localhost:8080/v1/systemone", poster.calls.single())
        val ipv4 = DecisionBackend(
            AiConfig(provider = "decision", decisionApiKey = "k", baseUrl = "http://127.0.0.1:8080"),
            FakePoster({ _: String -> okJson("""{"models":["jev-latest"]}""") }),
        )
        assertEquals(true, ipv4.probe())
    }

    @Test
    fun deceptiveLoopbackHostsAreRejected() {
        for (base in listOf("http://localhost@evil.example", "http://localhost.evil.example")) {
            var threw = false
            try {
                DecisionBackend(
                    AiConfig(provider = "decision", decisionApiKey = "k", baseUrl = base),
                    FakePoster({ _: String -> throw AssertionError("no HTTP to a rejected base") }),
                ).score("""{"request":"x"}""", mapOf("a" to mapOf("type" to "noul")))
            } catch (_: AiException) {
                threw = true
            }
            assertTrue(threw, base)
        }
    }

    @Test
    fun nonHttpBaseAndMalformedUriAreRejected() {
        for (base in listOf("ftp://example.com/files", "http://[::1")) {
            var threw = false
            try {
                DecisionBackend(
                    AiConfig(provider = "decision", decisionApiKey = "k", baseUrl = base),
                    FakePoster({ _: String -> throw AssertionError("no HTTP to a rejected base") }),
                ).score("""{"request":"x"}""", mapOf("a" to mapOf("type" to "noul")))
            } catch (_: AiException) {
                threw = true
            }
            assertTrue(threw, base)
        }
    }
}
