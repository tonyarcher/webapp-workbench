package rssapi.ai

import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import rssapi.persist.AiQuotaRepo
import java.time.Instant
import java.util.Optional
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

private class HighlightPoster(private val handler: (method: String, url: String, body: String) -> HttpResult) :
    HttpPoster {
    override fun get(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult = handler("GET", url, "")

    override fun post(url: String, headers: Map<String, String>, body: String, timeoutMs: Long): HttpResult =
        handler("POST", url, body)

    override fun delete(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult =
        handler("DELETE", url, "")
}

private fun ok(json: String) = HttpResult(200, json)

class AiHighlightServiceTest {
    private val uid = UUID.randomUUID()

    private fun quotaRepo(): AiQuotaRepo {
        val repo: AiQuotaRepo = mock()
        whenever(repo.findById(any())).thenReturn(Optional.empty())
        return repo
    }

    private fun quotas(): AiQuotaService {
        val q = AiQuotaService(quotaRepo())
        q.clock = java.time.Clock.fixed(Instant.parse("2026-11-14T12:00:00Z"), java.time.ZoneOffset.UTC)
        return q
    }

    private val threeSentences =
        "Battery storage costs fell again this quarter according to analysts. " +
            "Grid operators say the decline is finally making long duration storage economical. " +
            "Developers are already reworking projects that were shelved as too expensive last year."

    private fun service(poster: HttpPoster, decisionKey: String = "test-key"): AiHighlightService {
        val config = AiConfig(provider = "decision", decisionApiKey = decisionKey)
        return AiHighlightService(DecisionBackend(config, poster), quotas(), config)
    }

    @Test
    fun unavailableWhenNoDecisionKey() {
        val poster = HighlightPoster { _, _, _ -> throw AssertionError("no HTTP when unconfigured") }
        assertFalse(service(poster, decisionKey = "").highlights(uid, "Batteries", threeSentences, 2).available)
    }

    @Test
    fun unavailableWhenProbeFails() {
        val poster = HighlightPoster { _, url, _ ->
            if (url.endsWith("/v1/models")) HttpResult(500, "{}") else throw AssertionError("no score call")
        }
        assertFalse(service(poster).highlights(uid, "Batteries", threeSentences, 2).available)
    }

    @Test
    fun selectsTopExcerptsAndScores() {
        val poster = HighlightPoster { method, url, _ ->
            when {
                method == "GET" && url.endsWith("/v1/models") -> ok("""{"data":[{"id":"jev"}]}""")

                else -> ok(
                    """{"answers":{
                    "excerpt_0":{"noul":0.8},
                    "excerpt_1":{"noul":0.2},
                    "excerpt_2":{"noul":0.7},
                    "interesting":{"score":1.4},
                    "spam":{"noul":0.1}
                    }}""",
                )
            }
        }
        val result = service(poster).highlights(uid, "Batteries", threeSentences, 3)
        assertTrue(result.available)
        assertEquals(listOf(0, 2), result.excerpts.map { it.index })
        assertEquals(0.8, result.excerpts[0].score, 0.001)
        assertEquals(0.7, result.interesting!!, 0.001)
        assertEquals(0.1, result.spam!!, 0.001)
    }

    @Test
    fun noCandidatesReturnsAvailableButEmpty() {
        val poster = HighlightPoster { _, _, _ -> throw AssertionError("no decision call without candidates") }
        val result = service(poster).highlights(uid, "Batteries", null, 2)
        assertTrue(result.available)
        assertTrue(result.excerpts.isEmpty())
    }

    @Test
    fun missingOrLowScoresAreSkippedAndHighScoresClamp() {
        val poster = HighlightPoster { method, url, _ ->
            when {
                method == "GET" && url.endsWith("/v1/models") -> ok("""{"data":[{"id":"jev"}]}""")

                else -> ok(
                    """{"answers":{
                    "excerpt_0":{"noul":0.2},
                    "excerpt_2":{"noul":0.9},
                    "interesting":{"score":5.0},
                    "spam":{"noul":3.0}
                    }}""",
                )
            }
        }
        val result = service(poster).highlights(uid, "Batteries", threeSentences, 2)
        assertTrue(result.available)
        assertEquals(listOf(2), result.excerpts.map { it.index })
        assertEquals(1.0, result.interesting!!, 0.001)
        assertEquals(1.0, result.spam!!, 0.001)
    }

    @Test
    fun missingScoresFallBackToNullSignals() {
        val poster = HighlightPoster { method, url, _ ->
            when {
                method == "GET" && url.endsWith("/v1/models") -> ok("{}")
                else -> ok("""{"answers":{}}""")
            }
        }
        val result = service(poster).highlights(uid, "Batteries", threeSentences, 2)
        assertTrue(result.available)
        assertTrue(result.excerpts.isEmpty())
        assertEquals(null, result.interesting)
        assertEquals(null, result.spam)
    }

    @Test
    fun backendFailureIsUnavailable() {
        val poster = HighlightPoster { method, url, _ ->
            if (method == "GET" && url.endsWith("/v1/models")) ok("{}") else throw AiException("down")
        }
        assertFalse(service(poster).highlights(uid, "Batteries", threeSentences, 2).available)
    }

    @Test
    fun candidatesStripMarkupDedupeAndCap() {
        val content = "<p>Battery costs fell again this quarter according to analysts.</p>" +
            "<p>Short.</p>" +
            "<p>Battery costs fell again this quarter according to analysts.</p>" +
            List(12) { "Extra sentence number $it that is long enough to keep as a candidate." }.joinToString(" ")
        val candidates = service(HighlightPoster { _, _, _ -> throw AssertionError("unused") })
            .candidatesOf(content)
        assertTrue(candidates.size <= 8)
        assertTrue(candidates.none { it.text.contains('<') })
        assertTrue(candidates.none { it.text.length < 40 })
        assertEquals(candidates.map { it.text }, candidates.map { it.text }.distinct())
    }
}
