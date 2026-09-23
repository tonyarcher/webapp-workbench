package rssapi.ai

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class OpenCodeBackendBranchTest {
    private fun poster(
        health: String = """{"healthy":true}""",
        providers: String = """{"connected":["openai"]}""",
        session: String = """{"id":"s1"}""",
        message: String = """{"parts":[{"type":"text","text":"hi"}]}""",
        failDelete: Boolean = false,
    ): HttpPoster = object : HttpPoster {
        override fun get(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult = when {
            url.endsWith("/global/health") -> HttpResult(200, health)
            url.endsWith("/provider") -> HttpResult(200, providers)
            else -> HttpResult(404, "{}")
        }
        override fun post(url: String, headers: Map<String, String>, body: String, timeoutMs: Long): HttpResult = when {
            url.endsWith("/session") -> HttpResult(200, session)
            url.contains("/message") -> HttpResult(200, message)
            else -> HttpResult(404, "{}")
        }
        override fun delete(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult {
            if (failDelete) throw AiException("gone")
            return HttpResult(200, "")
        }
    }

    private fun config() = AiConfig(provider = "opencode", baseUrl = "http://x", model = "openai/gpt")

    @Test
    fun probePaths() {
        assertFalse(OpenCodeBackend(AiConfig(), poster()).probe())
        assertFalse(OpenCodeBackend(config().copy(baseUrl = ""), poster()).probe())
        assertFalse(OpenCodeBackend(config(), poster(health = """{"healthy":false}""")).probe())
        assertFalse(OpenCodeBackend(config(), poster(providers = """{"connected":["other"]}""")).probe())
        assertTrue(OpenCodeBackend(config(), poster()).probe())
    }

    @Test
    fun probeIoFailure() {
        val failing = object : HttpPoster {
            override fun get(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult =
                throw AiException("down")
            override fun post(url: String, headers: Map<String, String>, body: String, timeoutMs: Long): HttpResult =
                throw AiException("down")
            override fun delete(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult =
                HttpResult(200, "")
        }
        assertFalse(OpenCodeBackend(config(), failing).probe())
    }

    @Test
    fun summarizeFlow() {
        assertEquals("hi", OpenCodeBackend(config(), poster()).summarize("sys", "text"))
        assertEquals("hi", OpenCodeBackend(config(), poster(failDelete = true)).summarize("sys", "text"))
        assertFailsWith<AiException> {
            OpenCodeBackend(config(), poster(session = """{"noid":1}""")).summarize("sys", "text")
        }
        assertFailsWith<AiException> {
            OpenCodeBackend(config(), poster(message = """{"parts":[]}""")).summarize("sys", "text")
        }
    }

    @Test
    fun splits() {
        assertEquals("openai" to "gpt", OpenCodeBackend.splitModel("openai/gpt"))
        assertEquals("openai", OpenCodeBackend.providerOf("openai/gpt"))
        assertFailsWith<AiException> { OpenCodeBackend.splitModel("nope") }
        assertFailsWith<AiException> { OpenCodeBackend.splitModel("/lead") }
        assertFailsWith<AiException> { OpenCodeBackend.splitModel("trail/") }
    }

    @Test
    fun extracts() {
        val body = """{"parts":[{"type":"tool","text":"x"},{"type":"text","text":"a"},{"type":"text","text":"b"}]}"""
        assertEquals("a\nb", OpenCodeBackend.extractText(body))
        assertFailsWith<AiException> { OpenCodeBackend.extractText("""{"parts":[]}""") }
        assertFailsWith<AiException> { OpenCodeBackend.extractText("not json") }
    }
}
