package userapi

import kotlin.test.Test
import kotlin.test.assertEquals

class SettingsTest {
    @Test
    fun defaultsPortAndService() {
        val s = settingsFromEnv(requiredEnv() + emptyMap())
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
            requiredEnv() +
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
        assertEquals(true, settingsFromEnv(requiredEnv() + mapOf("COOKIE_SECURE" to "true")).cookieSecure)
        for (value in listOf("1", "yes", "on")) {
            assertEquals(
                true,
                settingsFromEnv(requiredEnv() + mapOf("COOKIE_SECURE" to value)).cookieSecure,
                "COOKIE_SECURE=$value must be truthy, matching Spring's Boolean binding",
            )
        }
        assertEquals(false, settingsFromEnv(requiredEnv() + mapOf("COOKIE_SECURE" to "off")).cookieSecure)
    }

    @Test
    fun swaggerEnabledFromEnv() {
        assertEquals(false, settingsFromEnv(requiredEnv() + emptyMap()).swaggerEnabled)
        for (value in listOf("1", "true", "TRUE", "yes", "on")) {
            assertEquals(
                true,
                settingsFromEnv(requiredEnv() + mapOf("SWAGGER_ENABLED" to value)).swaggerEnabled,
                "SWAGGER_ENABLED=$value must be truthy, or springdoc and the gate disagree",
            )
        }
        for (value in listOf("0", "false", "no", "off", "banana")) {
            assertEquals(
                false,
                settingsFromEnv(requiredEnv() + mapOf("SWAGGER_ENABLED" to value)).swaggerEnabled,
                "SWAGGER_ENABLED=$value must be falsy",
            )
        }
    }

    @Test
    fun badLogLevelBecomesInfo() {
        val s = settingsFromEnv(requiredEnv() + mapOf("LOG_LEVEL" to "verbose"))
        assertEquals("info", s.logLevel)
    }
}
