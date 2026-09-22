package rssapi.ai

import java.time.Instant
import java.util.Optional
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import rssapi.persist.AiQuotaEntity
import rssapi.persist.AiQuotaRepo
import rssapi.web.ApiException

private class FakePoster(private val handler: (method: String, url: String, body: String) -> HttpResult) : HttpPoster {
    val calls = mutableListOf<String>()
    val bodies = mutableListOf<String>()
    override fun get(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult {
        calls.add("GET $url")
        return handler("GET", url, "")
    }
    override fun post(url: String, headers: Map<String, String>, body: String, timeoutMs: Long): HttpResult {
        calls.add("POST $url")
        bodies.add(body)
        return handler("POST", url, body)
    }
    override fun delete(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult {
        calls.add("DELETE $url")
        return handler("DELETE", url, "")
    }
}

private fun okJson(json: String) = HttpResult(200, json)

class AiServiceTest {
    private val now = Instant.parse("2026-09-13T12:00:00Z")
    private val uid = UUID.randomUUID()

    private fun quotaRepo(): AiQuotaRepo {
        val repo: AiQuotaRepo = mock()
        whenever(repo.findById(any())).thenReturn(Optional.empty())
        return repo
    }

    private fun service(config: AiConfig, poster: HttpPoster): AiService {
        val quotas = AiQuotaService(quotaRepo())
        quotas.clock = java.time.Clock.fixed(now, java.time.ZoneOffset.UTC)
        return AiService(quotas, config, poster)
    }

    private fun ollamaConfig() = AiConfig(provider = "ollama", baseUrl = "http://ollama:11434", model = "qwen3:8b")

    @Test
    fun statusOffWhenUnconfigured() {
        val poster = FakePoster { _, _, _ -> throw AssertionError("no HTTP when off") }
        val status = AiService(AiQuotaService(quotaRepo()), AiConfig(), poster).status()
        assertFalse(status.available)
    }

    @Test
    fun ollamaStatusChecksModelTag() {
        val poster = FakePoster { _, url, _ ->
            if (url.endsWith("/api/tags")) okJson("""{"models":[{"name":"qwen3:8b"}]}""")
            else okJson("Ollama is running")
        }
        assertTrue(service(ollamaConfig(), poster).status().available)
    }

    @Test
    fun ollamaStatusFalseWhenModelMissing() {
        val poster = FakePoster { _, url, _ ->
            if (url.endsWith("/api/tags")) okJson("""{"models":[]}""") else okJson("Ollama is running")
        }
        assertFalse(service(ollamaConfig(), poster).status().available)
    }

    @Test
    fun opencodeStatusChecksConnectedProvider() {
        val poster = FakePoster { _, url, _ ->
            when {
                url.endsWith("/global/health") -> okJson("""{"healthy":true,"version":"1.18.21"}""")
                url.endsWith("/provider") -> okJson("""{"connected":["opencode"]}""")
                else -> throw AssertionError("unexpected $url")
            }
        }
        val config = AiConfig(provider = "opencode", baseUrl = "http://opencode:4096", model = "opencode/big-pickle")
        assertTrue(service(config, poster).status().available)
    }

    @Test
    fun summarizeOllamaReturnsText() {
        val poster = FakePoster { _, url, _ ->
            okJson("""{"choices":[{"message":{"content":"- a\n- b"}}]}""")
        }
        val summary = service(ollamaConfig(), poster).summarize(uid, "T", "Some body text here")
        assertEquals("- a\n- b", summary)
        assertTrue(poster.calls.any { it.contains("/v1/chat/completions") })
    }

    @Test
    fun summarizeOpencodeCleansUpSession() {
        val poster = FakePoster { method, url, _ ->
            when {
                method == "POST" && url.endsWith("/session") -> okJson("""{"id":"s1"}""")
                url.contains("/session/s1/message") -> okJson("""{"parts":[{"type":"text","text":"- x"}]}""")
                else -> okJson("{}")
            }
        }
        val config = AiConfig(provider = "opencode", baseUrl = "http://opencode:4096", model = "opencode/big-pickle")
        assertEquals("- x", service(config, poster).summarize(uid, null, "Some body text here"))
        assertTrue(poster.calls.any { it == "DELETE http://opencode:4096/session/s1" })
        val message = poster.bodies.first { it.contains("\"parts\"") }
        assertTrue(message.contains(""""tools":{"*":false}"""), "message denies all tools")
        assertTrue(message.contains(""""providerID":"opencode"""") && message.contains(""""modelID":"big-pickle""""))
    }

    @Test
    fun summarizeOpencodeFailureStillCleansUpSession() {
        val poster = FakePoster { method, url, _ ->
            when {
                method == "POST" && url.endsWith("/session") -> okJson("""{"id":"s9"}""")
                url.contains("/session/s9/message") -> HttpResult(500, "down")
                else -> okJson("{}")
            }
        }
        val config = AiConfig(provider = "opencode", baseUrl = "http://opencode:4096", model = "opencode/big-pickle")
        val err = assertFailsWith<ApiException> { service(config, poster).summarize(uid, null, "Some body text here") }
        assertEquals(502, err.status)
        assertTrue(poster.calls.any { it == "DELETE http://opencode:4096/session/s9" })
    }

    @Test
    fun summarizeStandardPromptIsUnchanged() {
        val poster = FakePoster { _, _, _ ->
            okJson("""{"choices":[{"message":{"content":"- a"}}]}""")
        }
        service(ollamaConfig(), poster).summarize(uid, "T", "Some body text here")
        val body = poster.bodies.single()
        assertTrue(body.contains(""""content":"$AI_SYSTEM_PROMPT""""))
        assertFalse(body.contains("bullet points"))
    }

    @Test
    fun summarizeBriefRequestsThreeBullets() {
        val poster = FakePoster { _, _, _ ->
            okJson("""{"choices":[{"message":{"content":"- a"}}]}""")
        }
        service(ollamaConfig(), poster).summarize(uid, "T", "Some body text here", SummaryLength.BRIEF)
        assertTrue(poster.bodies.single().contains("Summarize in exactly 3 short bullet points."))
    }

    @Test
    fun summarizeDeepRequestsEightToTenBullets() {
        val poster = FakePoster { _, _, _ ->
            okJson("""{"choices":[{"message":{"content":"- a"}}]}""")
        }
        service(ollamaConfig(), poster).summarize(uid, null, "Some body text here", SummaryLength.DEEP)
        assertTrue(poster.bodies.single().contains("Summarize in 8-10 short bullet points."))
    }

    @Test
    fun summaryLengthParseIsStrict() {
        assertEquals(SummaryLength.STANDARD, SummaryLength.parse(null))
        assertEquals(SummaryLength.STANDARD, SummaryLength.parse("standard"))
        assertEquals(SummaryLength.BRIEF, SummaryLength.parse("brief"))
        assertEquals(SummaryLength.DEEP, SummaryLength.parse("deep"))
        val err = assertFailsWith<ApiException> { SummaryLength.parse("long") }
        assertEquals(400, err.status)
    }

    @Test
    fun summarizeBlankTextIs400() {
        val poster = FakePoster { _, _, _ -> throw AssertionError("no HTTP on validation failure") }
        val err = assertFailsWith<ApiException> { service(ollamaConfig(), poster).summarize(uid, null, "  ") }
        assertEquals(400, err.status)
    }

    @Test
    fun summarizeUnconfiguredIs503() {
        val poster = FakePoster { _, _, _ -> throw AssertionError("no HTTP when off") }
        val service = AiService(AiQuotaService(quotaRepo()), AiConfig(), poster)
        val err = assertFailsWith<ApiException> { service.summarize(uid, null, "x") }
        assertEquals(503, err.status)
    }

    @Test
    fun summarizeBackendFailureIs502() {
        val poster = FakePoster { _, _, _ -> throw AiException("conn refused") }
        val err = assertFailsWith<ApiException> { service(ollamaConfig(), poster).summarize(uid, null, "x") }
        assertEquals(502, err.status)
    }

    @Test
    fun quotaExceededNeverCallsBackend() {
        val repo: AiQuotaRepo = mock()
        val spent = AiQuotaEntity(uid, now, 30, now, 5)
        whenever(repo.findById(uid)).thenReturn(Optional.of(spent))
        val quotas = AiQuotaService(repo)
        quotas.clock = java.time.Clock.fixed(now, java.time.ZoneOffset.UTC)
        val poster = FakePoster { _, _, _ -> throw AssertionError("quota must gate the backend") }
        val err = assertFailsWith<ApiException> { AiService(quotas, ollamaConfig(), poster).summarize(uid, null, "x") }
        assertEquals(429, err.status)
        verify(repo, never()).saveAndFlush(any<AiQuotaEntity>())
    }
}
