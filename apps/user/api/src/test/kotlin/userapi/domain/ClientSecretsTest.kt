package userapi.domain

import java.security.MessageDigest
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * The rule that lets a non-PKCE flow exist at all.
 *
 * A confidential client may skip PKCE only because it authenticates at the token
 * endpoint instead. Every case below is a way that can go wrong, and each one
 * silently downgrades a client to public if it is wrong in the permissive
 * direction.
 */
class ClientSecretsTest {
    private fun digest(value: String): String =
        MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }

    private val secrets = ClientSecrets(mapOf("gitea" to digest("s3cret")))

    @Test
    fun `a client with a digest is confidential`() {
        assertTrue(secrets.isConfidential("gitea"))
    }

    @Test
    fun `a client with no digest is public`() {
        assertFalse(secrets.isConfidential("rss-reader"))
        assertFalse(ClientSecrets(emptyMap()).isConfidential("anything"))
    }

    @Test
    fun `the right secret verifies`() {
        assertTrue(secrets.verify("gitea", "s3cret"))
    }

    @Test
    fun `a wrong secret does not verify`() {
        assertFalse(secrets.verify("gitea", "wrong"))
        assertFalse(secrets.verify("gitea", "s3cre"))
        assertFalse(secrets.verify("gitea", "s3cret "))
        assertFalse(secrets.verify("gitea", "S3CRET"))
    }

    /** An empty or absent secret must never match, or a blank form field passes. */
    @Test
    fun `an empty or absent secret never verifies`() {
        assertFalse(secrets.verify("gitea", null))
        assertFalse(secrets.verify("gitea", ""))
        assertFalse(secrets.verify("gitea", "   "))
    }

    @Test
    fun `an unknown client never verifies, even with a plausible secret`() {
        assertFalse(secrets.verify("rss-reader", "s3cret"))
        assertFalse(ClientSecrets(emptyMap()).verify("gitea", "s3cret"))
    }

    /** The digest is over the raw bytes; a padded or unicode secret still has to match. */
    @Test
    fun `secrets with awkward bytes still verify exactly`() {
        val odd = "pässwörd with spaces"
        val one = ClientSecrets(mapOf("c" to digest(odd)))
        assertTrue(one.verify("c", odd))
        assertFalse(one.verify("c", "passwörd with spaces"))
    }
}
