package rssapi

import kotlin.test.Test
import kotlin.test.assertEquals

class SettingsBranchTest {
    @Test
    fun defaults() {
        val s = settingsFromEnv(emptyMap())
        assertEquals(3001, s.port)
        assertEquals("rss-api", s.service)
        assertEquals(60_000L, s.pollTickMs)
        assertEquals(15 * 60_000L, s.pollMaxAgeMs)
        assertEquals(false, s.allowLocalFetch)
    }

    @Test
    fun envOverrides() {
        val s = settingsFromEnv(
            mapOf(
                "PORT" to "4000",
                "DATABASE_URL" to "postgres://x",
                "LOG_LEVEL" to "debug",
                "SERVICE" to "svc",
                "POLL_TICK_MS" to "1000",
                "POLL_MAX_AGE_MS" to "2000",
                "RSS_ALLOW_LOCAL_FETCH" to "1",
            ),
        )
        assertEquals(4000, s.port)
        assertEquals("postgres://x", s.databaseUrl)
        assertEquals(true, s.allowLocalFetch)
    }

    @Test
    fun badNumbersFallback() {
        val s = settingsFromEnv(mapOf("PORT" to "abc", "POLL_TICK_MS" to "xx", "SERVICE" to "  "))
        assertEquals(3001, s.port)
        assertEquals("rss-api", s.service)
    }
}
