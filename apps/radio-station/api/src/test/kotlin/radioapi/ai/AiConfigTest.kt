package radioapi.ai

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AiConfigTest {
    @Test
    fun defaultsStayOff() {
        val config = aiConfigFromEnv(emptyMap())
        assertEquals("", config.provider)
        assertEquals("", config.decisionApiKey)
    }

    @Test
    fun readsDecisionKeyAndTrimsBase() {
        val config = aiConfigFromEnv(
            mapOf(
                "AI_PROVIDER" to "decision",
                "AI_API_URL" to "https://api.typesafe.ai/",
                "TYPESAFE_API_KEY" to "  secret-key  ",
            ),
        )
        assertEquals("decision", config.provider)
        assertEquals("https://api.typesafe.ai", config.baseUrl)
        assertEquals("secret-key", config.decisionApiKey)
    }

    @Test
    fun toStringHidesSecrets() {
        val config = AiConfig(provider = "decision", decisionApiKey = "secret-key")
        assertTrue(!config.toString().contains("secret-key"))
    }

    @Test
    fun invalidNumbersFallBackToDefaults() {
        val config = aiConfigFromEnv(
            mapOf(
                "AI_TIMEOUT_MS" to "not-a-number",
                "AI_PROBE_TIMEOUT_MS" to "nope",
                "AI_HOURLY_LIMIT" to "x",
                "AI_DAILY_LIMIT" to "y",
                "AI_MAX_INPUT_CHARS" to "z",
            ),
        )
        assertEquals(90_000L, config.timeoutMs)
        assertEquals(5_000L, config.probeTimeoutMs)
        assertEquals(30, config.hourlyLimit)
        assertEquals(100, config.dailyLimit)
        assertEquals(8_000, config.maxInputChars)
    }

    @Test
    fun providerLowercasesAndBaseTrimsSlash() {
        val config = aiConfigFromEnv(
            mapOf("AI_PROVIDER" to "Decision", "AI_API_URL" to "https://host///"),
        )
        assertEquals("decision", config.provider)
        assertEquals("https://host", config.baseUrl)
    }
}
