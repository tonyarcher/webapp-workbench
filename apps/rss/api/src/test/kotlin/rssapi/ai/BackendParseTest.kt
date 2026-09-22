package rssapi.ai

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse

class BackendParseTest {
    @Test
    fun ollamaExtractsFirstChoice() {
        assertEquals(
            "hello",
            OllamaBackend.extractText("""{"choices":[{"message":{"content":"  hello  "}}]}"""),
        )
    }

    @Test
    fun ollamaEmptyReplyFails() {
        assertFailsWith<AiException> { OllamaBackend.extractText("""{"choices":[]}""") }
    }

    @Test
    fun splitModelCutsFirstSlash() {
        assertEquals("opencode" to "big-pickle", OpenCodeBackend.splitModel("opencode/big-pickle"))
        assertEquals("edenai" to "a/b/c", OpenCodeBackend.splitModel("edenai/a/b/c"))
    }

    @Test
    fun splitModelRejectsBareNames() {
        assertFailsWith<AiException> { OpenCodeBackend.splitModel("justamodel") }
    }

    @Test
    fun openCodeJoinsTextParts() {
        val body = """{"parts":[
            {"type":"reasoning","text":"hmm"},
            {"type":"text","text":"- a"},
            {"type":"text","text":"- b"}]}"""
        assertEquals("- a\n- b", OpenCodeBackend.extractText(body))
    }

    @Test
    fun openCodeEmptyReplyFails() {
        assertFailsWith<AiException> { OpenCodeBackend.extractText("""{"parts":[]}""") }
    }

    @Test
    fun blankConfigDisablesProbe() {
        val dead = FakeProbePoster()
        assertEquals(false, OllamaBackend(AiConfig(), dead).probe())
        assertEquals(false, OpenCodeBackend(AiConfig(), dead).probe())
    }

    private class FakeProbePoster : HttpPoster {
        override fun get(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult =
            throw AssertionError("probe must short-circuit without config")

        override fun post(url: String, headers: Map<String, String>, body: String, timeoutMs: Long): HttpResult =
            throw AssertionError("probe must short-circuit without config")

        override fun delete(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult =
            throw AssertionError("probe must short-circuit without config")
    }

    @Test
    fun badUrlsFailFastWithoutNetwork() {
        assertFailsWith<AiException> { JdkHttpPoster().post("not a url", emptyMap(), "{}", 500) }
        assertFailsWith<AiException> { JdkHttpPoster().get("htp://modelhost:11434/", emptyMap(), 500) }
    }

    @Test
    fun probeSurvivesMalformedUrl() {
        val poster = object : HttpPoster {
            override fun get(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult =
                throw IllegalArgumentException("bad")

            override fun post(url: String, headers: Map<String, String>, body: String, timeoutMs: Long): HttpResult =
                throw IllegalArgumentException("bad")

            override fun delete(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult =
                throw IllegalArgumentException("bad")
        }
        val config = AiConfig(provider = "ollama", baseUrl = "http://x", model = "m")
        kotlin.test.assertFalse(OllamaBackend(config, poster).probe())
    }

    @Test
    fun jevKeyParsesTrimmedAndStaysOutOfToString() {
        val config = aiConfigFromEnv(mapOf("AI_PROVIDER" to "jev", "TYPESAFE_API_KEY" to "  secret-key  "))
        assertEquals("jev", config.provider)
        assertEquals("secret-key", config.jevApiKey)
        assertFalse(config.toString().contains("secret-key"))
        assertEquals("", aiConfigFromEnv(emptyMap()).jevApiKey)
    }

    @Test
    fun configParsesEnvWithSafeDefaults() {
        val config = aiConfigFromEnv(mapOf("AI_PROVIDER" to " Ollama ", "AI_API_URL" to "http://x:11434/"))
        assertEquals("ollama", config.provider)
        assertEquals("http://x:11434", config.baseUrl)
        assertEquals(30, config.hourlyLimit)
        assertEquals(8_000, config.maxInputChars)
        assertEquals("", aiConfigFromEnv(emptyMap()).provider)
    }
}
