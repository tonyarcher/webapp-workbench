package radioapi.safety

import radioapi.ai.AiConfig
import radioapi.ai.AiException
import radioapi.ai.DecisionBackend
import radioapi.ai.HttpPoster
import radioapi.ai.HttpResult
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

private class SafetyFakePoster(private val handler: (body: String) -> HttpResult) : HttpPoster {
    val calls = mutableListOf<String>()
    var lastBody: String = ""
    override fun get(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult {
        calls.add("GET $url")
        throw AssertionError("safety scoring only POSTs")
    }

    override fun post(url: String, headers: Map<String, String>, body: String, timeoutMs: Long): HttpResult {
        calls.add("POST $url")
        lastBody = body
        return handler(body)
    }

    override fun delete(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult {
        calls.add("DELETE $url")
        throw AssertionError("safety scoring only POSTs")
    }
}

private fun safetyPoster(reply: String): SafetyFakePoster = SafetyFakePoster { HttpResult(200, reply) }

private fun safetyOf(poster: SafetyFakePoster): TrackSafetyProvider =
    TrackSafetyProvider(DecisionBackend(AiConfig(provider = "decision", decisionApiKey = "test-key"), poster))

private fun track(id: String, explicit: Boolean = false): SafetyCandidate =
    SafetyCandidate(id = id, artist = "a-$id", title = "t-$id", explicit = explicit)

private fun answers(vararg entries: String): String = """{"model":"jev-latest","answers":{${entries.joinToString(",")}},
       "usage":{"input_tokens":10,"output_tokens":5}}"""

private fun noul(id: String, value: String): String = """"$id":{"type":"noul","noul":$value}"""

private fun score(id: String, value: String): String = """"$id":{"type":"score","score":$value}"""

class TrackSafetyProviderTest {
    @Test
    fun emptyBatchSkipsHttp() {
        val poster = SafetyFakePoster { throw AssertionError("no HTTP for an empty batch") }
        assertTrue(safetyOf(poster).scoreBatch("top40", emptyList()).isEmpty())
    }

    @Test
    fun mapsExplicitAndFit() {
        val poster = safetyPoster(answers(noul("a_explicit", "0.1"), score("a_fit", "1.6")))
        val out = safetyOf(poster).scoreBatch("top40", listOf(track("a")))
        assertEquals(0.9, out.getValue("a").safe, 1e-9)
        assertEquals(0.8, out.getValue("a").fit, 1e-9)
        assertTrue(poster.lastBody.contains("candidates[0]"))
        assertTrue(poster.lastBody.contains("daytime radio"))
    }

    @Test
    fun clampsOutOfRangeAnswers() {
        val poster = safetyPoster(answers(noul("a_explicit", "1.5"), score("a_fit", "5.0")))
        val out = safetyOf(poster).scoreBatch("top40", listOf(track("a")))
        assertEquals(0.0, out.getValue("a").safe)
        assertEquals(1.0, out.getValue("a").fit)
    }

    @Test
    fun partialAnswersFallBackPerTrack() {
        val poster = safetyPoster(answers(noul("a_explicit", "0.2")))
        val out = safetyOf(poster).scoreBatch("top40", listOf(track("a")))
        assertNull(out["a"])
    }

    @Test
    fun capsBatchAtTwenty() {
        val reply = answers(
            *(0 until 20).flatMap { i ->
                listOf(noul("c${i}_explicit", "0.0"), score("c${i}_fit", "1.0"))
            }.toTypedArray(),
        )
        val poster = safetyPoster(reply)
        val many = (0 until 100).map { track("c$it") }
        val out = safetyOf(poster).scoreBatch("top40", many)
        assertEquals(20, out.size)
    }

    @Test
    fun listFailureThrowsForCallerFallback() {
        val poster = SafetyFakePoster { throw AiException("decision down") }
        var threw = false
        try {
            safetyOf(poster).scoreBatch("top40", listOf(track("a")))
        } catch (_: AiException) {
            threw = true
        }
        assertTrue(threw)
    }

    @Test
    fun fallbackUsesExplicitColumn() {
        assertEquals(0.0, safetyFallback(true).safe)
        assertEquals(1.0, safetyFallback(false).safe)
    }

    @Test
    fun malformedAnswersFallBackPerTrack() {
        val poster = safetyPoster(answers(noul("a_explicit", "1e999"), score("a_fit", "1e999")))
        val out = safetyOf(poster).scoreBatch("top40", listOf(track("a")))
        assertNull(out["a"])
    }
}
