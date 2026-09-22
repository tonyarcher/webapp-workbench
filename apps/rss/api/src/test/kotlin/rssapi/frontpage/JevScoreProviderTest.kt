package rssapi.frontpage

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import rssapi.ai.AiConfig
import rssapi.ai.AiException
import rssapi.ai.HttpPoster
import rssapi.ai.HttpResult
import rssapi.ai.JevBackend

private class ProviderFakePoster(
    private val handler: (body: String) -> HttpResult,
) : HttpPoster {
    val calls = mutableListOf<String>()
    var lastBody: String = ""
    override fun get(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult {
        calls.add("GET $url")
        throw AssertionError("batch scoring only POSTs")
    }
    override fun post(url: String, headers: Map<String, String>, body: String, timeoutMs: Long): HttpResult {
        calls.add("POST $url")
        lastBody = body
        return handler(body)
    }
    override fun delete(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult {
        calls.add("DELETE $url")
        throw AssertionError("batch scoring only POSTs")
    }
}

private fun providerPoster(reply: String): ProviderFakePoster =
    ProviderFakePoster { HttpResult(200, reply) }

private fun providerOf(poster: ProviderFakePoster): JevScoreProvider =
    JevScoreProvider(JevBackend(AiConfig(provider = "jev", jevApiKey = "test-key"), poster))

private fun candidate(id: String): JevCandidate = JevCandidate(
    id = id,
    title = "t-$id",
    feed = "f",
    hot = 6_300.0,
    input = SignalInput(hot = 6_300.0, popularity = 2.0, engagement = 1.0, affinity = 0.0, wordCount = 500),
)

private fun answers(vararg entries: String): String =
    """{"model":"jev-latest","answers":{${entries.joinToString(",")}},
       "usage":{"input_tokens":10,"output_tokens":5}}"""

private fun noul(id: String, value: String): String = """"$id":{"type":"noul","noul":$value}"""

private fun score(id: String, value: String): String = """"$id":{"type":"score","score":$value}"""

private fun choice(id: String, value: String): String = """"$id":{"type":"choice","choice":"$value"}"""

class JevScoreProviderTest {
    @Test
    fun emptyBatchSkipsHttp() {
        val poster = ProviderFakePoster { throw AssertionError("no HTTP for an empty batch") }
        assertTrue(providerOf(poster).scoreBatch(emptyList(), emptyMap(), emptyList()).isEmpty())
    }

    @Test
    fun mapsNoulAndScoreToUnitRange() {
        val poster = providerPoster(
            answers(noul("a_worthy", "0.9"), score("a_interest", "1.8"), choice("a_topic", "tech")),
        )
        val out = providerOf(poster).scoreBatch(emptyList(), emptyMap(), listOf(candidate("a")))
        assertEquals(0.9, out.getValue("a").worthy, 1e-9)
        assertEquals(0.9, out.getValue("a").interest, 1e-9)
        assertEquals("tech", out.getValue("a").topic)
        assertTrue(poster.lastBody.contains("candidates[0].title"))
        assertTrue(poster.lastBody.contains("Not interesting to this reader"))
        assertTrue(poster.lastBody.contains("Which topic best fits"))
    }

    @Test
    fun clampsOutOfRangeAnswers() {
        val poster = providerPoster(answers(noul("a_worthy", "1.5"), score("a_interest", "5.0")))
        val out = providerOf(poster).scoreBatch(emptyList(), emptyMap(), listOf(candidate("a")))
        assertEquals(1.0, out.getValue("a").worthy)
        assertEquals(1.0, out.getValue("a").interest)
    }

    @Test
    fun partialAnswersLeftOutForCallerFallback() {
        val poster = providerPoster(answers(noul("a_worthy", "0.7")))
        val out = providerOf(poster).scoreBatch(emptyList(), emptyMap(), listOf(candidate("a")))
        assertNull(out["a"])
    }

    @Test
    fun missingQuestionLeftOutForCallerFallback() {
        val poster = providerPoster(
            answers(
                noul("a_worthy", "0.9"),
                score("a_interest", "1.8"),
                score("b_interest", "0.2"),
            ),
        )
        val provider = providerOf(poster)
        val out = provider.scoreBatch(emptyList(), emptyMap(), listOf(candidate("a"), candidate("b")))
        assertEquals(0.9, out.getValue("a").worthy, 1e-9)
        assertNull(out["b"])
    }

    @Test
    fun malformedAnswerLeftOutForCallerFallback() {
        val poster = providerPoster(answers(noul("a_worthy", "1e999"), score("a_interest", "1e999")))
        val out = providerOf(poster).scoreBatch(emptyList(), emptyMap(), listOf(candidate("a")))
        assertNull(out["a"])
    }

    @Test
    fun missingTopicMapsToNull() {
        val poster = providerPoster(answers(noul("a_worthy", "0.9"), score("a_interest", "1.8")))
        val out = providerOf(poster).scoreBatch(emptyList(), emptyMap(), listOf(candidate("a")))
        assertEquals(0.9, out.getValue("a").worthy, 1e-9)
        assertEquals(null, out.getValue("a").topic)
    }

    @Test
    fun unknownTopicMapsToNull() {
        val poster = providerPoster(
            answers(noul("a_worthy", "0.9"), score("a_interest", "1.8"), choice("a_topic", "gossip")),
        )
        val out = providerOf(poster).scoreBatch(emptyList(), emptyMap(), listOf(candidate("a")))
        assertEquals(0.9, out.getValue("a").worthy, 1e-9)
        assertEquals(null, out.getValue("a").topic)
    }

    @Test
    fun capsBatchAtTwenty() {
        val reply = answers(
            *(0 until 20).flatMap { i ->
                listOf(noul("c${i}_worthy", "0.5"), score("c${i}_interest", "1.0"), choice("c${i}_topic", "news"))
            }.toTypedArray(),
        )
        val poster = providerPoster(reply)
        val many = (0 until 100).map { candidate("c$it") }
        val out = providerOf(poster).scoreBatch(emptyList(), emptyMap(), many)
        assertEquals(20, out.size)
        val questions = Regex("\"c\\d+_(worthy|interest|topic)\"").findAll(poster.lastBody).count()
        assertEquals(60, questions)
    }

    @Test
    fun listFailureThrowsForCallerFallback() {
        val poster = ProviderFakePoster { throw AiException("jev down") }
        var threw = false
        try {
            providerOf(poster).scoreBatch(emptyList(), emptyMap(), listOf(candidate("a")))
        } catch (_: AiException) {
            threw = true
        }
        assertTrue(threw)
    }
}
