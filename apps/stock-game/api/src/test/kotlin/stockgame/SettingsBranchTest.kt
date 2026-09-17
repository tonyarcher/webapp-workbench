package stockgame

import kotlin.test.Test
import kotlin.test.assertEquals

class SettingsBranchTest {
    @Test
    fun defaults() {
        val s = settingsFromEnv(emptyMap())
        assertEquals(3005, s.port)
        assertEquals("yahoo", s.provider)
        assertEquals(15 * 60_000L, s.quoteTtlMs)
    }

    @Test
    fun overrides() {
        val s = settingsFromEnv(
            mapOf(
                "PORT" to "4000",
                "PRICE_PROVIDER" to "fake",
                "QUOTE_TTL_MS" to "1000",
                "SERVICE" to "svc",
            ),
        )
        assertEquals(4000, s.port)
        assertEquals("fake", s.provider)
        assertEquals(1000L, s.quoteTtlMs)
    }

    @Test
    fun badNumbersFallback() {
        val s = settingsFromEnv(
            mapOf("PORT" to "abc", "QUOTE_TTL_MS" to "-5", "PRICE_PROVIDER" to "  "),
        )
        assertEquals(3005, s.port)
        assertEquals("yahoo", s.provider)
        assertEquals(15 * 60_000L, s.quoteTtlMs)
    }
}
