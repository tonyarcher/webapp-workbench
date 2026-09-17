package rssapi.ai

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class OllamaBackendBranchTest {
    private fun poster(
        getStatus: Int = 200,
        getBody: String = """{"models":[{"name":"llama3"}]}""",
        postStatus: Int = 200,
        postBody: String = """{"choices":[{"message":{"content":"hi"}}]}""",
    ): HttpPoster = object : HttpPoster {
        override fun get(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult =
            HttpResult(getStatus, getBody)
        override fun post(url: String, headers: Map<String, String>, body: String, timeoutMs: Long): HttpResult =
            HttpResult(postStatus, postBody)
        override fun delete(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult =
            HttpResult(200, "")
    }

    private fun config() = AiConfig(provider = "ollama", baseUrl = "http://x", model = "llama3")

    @Test
    fun probeEmptyConfig() {
        assertFalse(OllamaBackend(AiConfig(), poster()).probe())
        assertFalse(OllamaBackend(config().copy(baseUrl = ""), poster()).probe())
    }

    @Test
    fun probeStatusMismatch() {
        assertFalse(OllamaBackend(config(), poster(getStatus = 500)).probe())
        assertFalse(OllamaBackend(config(), poster(getBody = """{"models":[{"name":"other"}]}""")).probe())
        assertTrue(OllamaBackend(config(), poster()).probe())
        assertTrue(
            OllamaBackend(
                config().copy(model = "llama3"),
                poster(getBody = """{"models":[{"name":"llama3:latest"}]}"""),
            ).probe(),
        )
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
        assertFalse(OllamaBackend(config(), failing).probe())
    }

    @Test
    fun summarizePaths() {
        assertEquals("hi", OllamaBackend(config(), poster()).summarize("sys", "text"))
        assertFailsWith<AiException> {
            OllamaBackend(config(), poster(postBody = """{"choices":[]}""")).summarize("sys", "text")
        }
        assertFailsWith<AiException> {
            OllamaBackend(config(), poster(postStatus = 500, postBody = "err")).summarize("sys", "text")
        }
    }

    @Test
    fun configFromEnv() {
        val full = aiConfigFromEnv(
            mapOf(
                "AI_PROVIDER" to "Ollama",
                "AI_API_URL" to "http://x/",
                "AI_MODEL" to "m",
                "AI_TIMEOUT_MS" to "1000",
                "AI_PROBE_TIMEOUT_MS" to "2000",
                "AI_HOURLY_LIMIT" to "5",
                "AI_DAILY_LIMIT" to "50",
                "AI_MAX_INPUT_CHARS" to "100",
                "AI_API_USER" to "u",
                "AI_API_PASSWORD" to "p",
            ),
        )
        assertEquals("ollama", full.provider)
        assertEquals("http://x", full.baseUrl)
        assertEquals(1000L, full.timeoutMs)
        assertTrue(full.toString().contains("ollama"))
    }

    @Test
    fun configDefaults() {
        val empty = aiConfigFromEnv(emptyMap())
        assertEquals("", empty.provider)
        assertEquals(90_000L, empty.timeoutMs)
        assertEquals(5_000L, empty.probeTimeoutMs)
        val bad = aiConfigFromEnv(mapOf("AI_TIMEOUT_MS" to "abc", "AI_HOURLY_LIMIT" to "zz"))
        assertEquals(90_000L, bad.timeoutMs)
        assertEquals(30, bad.hourlyLimit)
    }
}
