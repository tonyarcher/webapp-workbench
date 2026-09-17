package userapi

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class SettingsBranchTest {
    @Test
    fun defaults() {
        val s = settingsFromEnv(emptyMap())
        assertEquals(3000, s.port)
        assertEquals("user-api", s.service)
        assertEquals(false, s.cookieSecure)
        assertEquals("localhost", s.rpId)
    }

    @Test
    fun overrides() {
        val s = settingsFromEnv(
            mapOf(
                "PORT" to "4000",
                "COOKIE_SECURE" to "true",
                "WEBAUTHN_RP_ID" to "example.com",
                "WEBAUTHN_ORIGINS" to "https://example.com",
                "OAUTH_ISSUER" to "https://example.com/issuer",
                "LOGIN_PATH" to "/login/",
                "SERVICE" to "svc",
            ),
        )
        assertEquals(4000, s.port)
        assertEquals(true, s.cookieSecure)
        assertEquals("example.com", s.rpId)
        assertEquals(setOf("https://example.com"), s.origins)
        assertEquals("https://example.com/issuer", s.issuer)
        assertEquals("/login/", s.loginPath)
    }

    @Test
    fun badValuesFallback() {
        val s = settingsFromEnv(
            mapOf(
                "PORT" to "abc",
                "SERVICE" to "  ",
                "COOKIE_SECURE" to "YES",
                "WEBAUTHN_ORIGINS" to "not a url at all,,,",
            ),
        )
        assertEquals(3000, s.port)
        assertEquals("user-api", s.service)
        assertTrue(s.cookieSecure)
        assertTrue(s.origins.isNotEmpty())
    }
}
