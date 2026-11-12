package calsync.ai

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
        val config = aiConfigFromEnv(mapOf("AI_TIMEOUT_MS" to "nope", "AI_HOURLY_LIMIT" to "x"))
        assertEquals(90_000L, config.timeoutMs)
        assertEquals(30, config.hourlyLimit)
    }

    @Test
    fun readsAllValidKnobs() {
        val config = aiConfigFromEnv(
            mapOf(
                "AI_TIMEOUT_MS" to "10",
                "AI_PROBE_TIMEOUT_MS" to "20",
                "AI_HOURLY_LIMIT" to "3",
                "AI_DAILY_LIMIT" to "7",
                "AI_MAX_INPUT_CHARS" to "100",
                "AI_API_USER" to "user",
                "AI_API_PASSWORD" to "pw",
            ),
        )
        assertEquals(10L, config.timeoutMs)
        assertEquals(20L, config.probeTimeoutMs)
        assertEquals(3, config.hourlyLimit)
        assertEquals(7, config.dailyLimit)
        assertEquals(100, config.maxInputChars)
        assertEquals("user", config.basicUser)
        assertEquals("pw", config.basicPassword)
    }
}
