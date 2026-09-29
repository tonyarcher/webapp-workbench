package userapi

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/**
 * OAUTH_CLIENT_SECRETS decides which clients are confidential, so a parse that
 * is too lenient silently downgrades a client to public -- it would then require
 * PKCE, which is safe, rather than the reverse. A parse that is too strict, or
 * that skips a bad entry, is the dangerous direction: it is why a malformed
 * entry fails at boot rather than being dropped.
 */
class ClientSecretSettingsTest {
    private val digest = "a".repeat(64)

    @Test
    fun `absent means no confidential clients`() {
        assertTrue(settingsFromEnv(requiredEnv()).clientSecretDigests.isEmpty())
        assertTrue(settingsFromEnv(requiredEnv() + ("OAUTH_CLIENT_SECRETS" to "")).clientSecretDigests.isEmpty())
    }

    @Test
    fun `one pair is parsed`() {
        val parsed = settingsFromEnv(
            requiredEnv() + ("OAUTH_CLIENT_SECRETS" to "gitea=$digest"),
        ).clientSecretDigests
        assertEquals(mapOf("gitea" to digest), parsed)
    }

    @Test
    fun `several pairs and stray whitespace are tolerated`() {
        val other = "b".repeat(64)
        val parsed = settingsFromEnv(
            requiredEnv() + ("OAUTH_CLIENT_SECRETS" to " gitea=$digest , rss=$other , "),
        ).clientSecretDigests
        assertEquals(mapOf("gitea" to digest, "rss" to other), parsed)
    }

    @Test
    fun `a short digest is refused rather than ignored`() {
        assertFailsWith<IllegalArgumentException> {
            settingsFromEnv(requiredEnv() + ("OAUTH_CLIENT_SECRETS" to "gitea=abc"))
        }
    }

    @Test
    fun `a non-hex digest is refused`() {
        assertFailsWith<IllegalArgumentException> {
            settingsFromEnv(requiredEnv() + ("OAUTH_CLIENT_SECRETS" to "gitea=${"z".repeat(64)}"))
        }
    }

    @Test
    fun `an uppercase digest is refused, because the comparison is lowercase hex`() {
        assertFailsWith<IllegalArgumentException> {
            settingsFromEnv(requiredEnv() + ("OAUTH_CLIENT_SECRETS" to "gitea=${"A".repeat(64)}"))
        }
    }

    @Test
    fun `a missing client id is refused`() {
        assertFailsWith<IllegalArgumentException> {
            settingsFromEnv(requiredEnv() + ("OAUTH_CLIENT_SECRETS" to "=$digest"))
        }
    }

    @Test
    fun `a missing digest is refused`() {
        assertFailsWith<IllegalArgumentException> {
            settingsFromEnv(requiredEnv() + ("OAUTH_CLIENT_SECRETS" to "gitea="))
        }
    }
}
