package fitnessapi

import kotlin.test.Test
import kotlin.test.assertEquals

class SettingsTest {
    @Test
    fun defaultsPortAndService() {
        val s = settingsFromEnv(emptyMap())
        assertEquals(3003, s.port)
        assertEquals("", s.databaseUrl)
        assertEquals("info", s.logLevel)
        assertEquals("fitness-api", s.service)
    }

    @Test
    fun readsEnv() {
        val s = settingsFromEnv(
            mapOf(
                "PORT" to "3000",
                "DATABASE_URL" to "postgres://u:p@localhost:5432/fitness",
                "LOG_LEVEL" to "debug",
                "SERVICE" to "fitness-api",
            ),
        )
        assertEquals(3000, s.port)
        assertEquals("postgres://u:p@localhost:5432/fitness", s.databaseUrl)
        assertEquals("debug", s.logLevel)
    }

    @Test
    fun badLogLevelBecomesInfo() {
        val s = settingsFromEnv(mapOf("LOG_LEVEL" to "verbose"))
        assertEquals("info", s.logLevel)
    }
}
