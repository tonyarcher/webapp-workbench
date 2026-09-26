package userapi

import kotlin.test.Test
import kotlin.test.assertEquals

class SettingsTest {
    @Test
    fun defaultsPortAndService() {
        val s = settingsFromEnv(emptyMap())
        assertEquals(3000, s.port)
        assertEquals("", s.databaseUrl)
        assertEquals("info", s.logLevel)
        assertEquals("user-api", s.service)
        assertEquals(false, s.cookieSecure)
        assertEquals("localhost", s.rpId)
    }

    @Test
    fun readsEnv() {
        val s = settingsFromEnv(
            mapOf(
                "PORT" to "3004",
                "DATABASE_URL" to "postgres://u:p@localhost:5432/users",
                "LOG_LEVEL" to "debug",
                "SERVICE" to "user-api",
            ),
        )
        assertEquals(3004, s.port)
        assertEquals("postgres://u:p@localhost:5432/users", s.databaseUrl)
        assertEquals("debug", s.logLevel)
        assertEquals(false, s.cookieSecure)
    }

    @Test
    fun cookieSecureFromEnv() {
        assertEquals(true, settingsFromEnv(mapOf("COOKIE_SECURE" to "true")).cookieSecure)
    }

    @Test
    fun swaggerEnabledFromEnv() {
        assertEquals(false, settingsFromEnv(emptyMap()).swaggerEnabled)
        for (value in listOf("1", "true", "TRUE", "yes", "on")) {
            assertEquals(
                true,
                settingsFromEnv(mapOf("SWAGGER_ENABLED" to value)).swaggerEnabled,
                "SWAGGER_ENABLED=$value must be truthy, or springdoc and the gate disagree",
            )
        }
        for (value in listOf("0", "false", "no", "off", "banana")) {
            assertEquals(
                false,
                settingsFromEnv(mapOf("SWAGGER_ENABLED" to value)).swaggerEnabled,
                "SWAGGER_ENABLED=$value must be falsy",
            )
        }
    }

    @Test
    fun badLogLevelBecomesInfo() {
        val s = settingsFromEnv(mapOf("LOG_LEVEL" to "verbose"))
        assertEquals("info", s.logLevel)
    }
}
