package userapi.domain

import java.security.MessageDigest

/**
 * Which OAuth clients may complete a flow without PKCE.
 *
 * PKCE exists to stop an attacker who intercepts an authorization code from
 * redeeming it. That threat is real for a PUBLIC client, which has no other
 * credential. A CONFIDENTIAL client authenticates at the token endpoint with a
 * secret, and RFC 6749 4.1.1 treats PKCE as recommended rather than required
 * for it -- the secret already binds the code to the client that requested it.
 *
 * This service has to tell those two apart, because Gitea is a confidential
 * client that cannot send PKCE: its fix is PR go-gitea/gitea#38202, which is open
 * and blocked by a feature freeze, so no released Gitea emits a code_challenge.
 * Requiring PKCE unconditionally would mean no Gitea sign-in at all; dropping it
 * unconditionally would hand every public client the weaker position.
 *
 * Secrets are compared by SHA-256 digest, in constant time, and never logged.
 * The digest rather than the value is what this holds, so a dump of Settings is
 * not a credential list.
 */
class ClientSecrets(private val digests: Map<String, String>) {
    /** True when this client is expected to authenticate at the token endpoint. */
    fun isConfidential(clientId: String): Boolean = digests.containsKey(clientId)

    /** True when [presented] is this client's secret. Empty never matches. */
    fun verify(clientId: String, presented: String?): Boolean {
        val expected = digests[clientId] ?: return false
        if (presented.isNullOrEmpty()) return false
        return constantTimeEquals(expected, digestOf(presented))
    }

    private fun digestOf(value: String): String =
        MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }

    /**
     * Compare without an early exit. A byte-at-a-time comparison leaks the
     * matching prefix length through timing, which is enough to recover a digest
     * one byte at a time given enough attempts.
     */
    private fun constantTimeEquals(a: String, b: String): Boolean {
        val left = a.toByteArray(Charsets.UTF_8)
        val right = b.toByteArray(Charsets.UTF_8)
        var diff = left.size xor right.size
        for (i in left.indices) {
            diff = diff or (left[i].toInt() xor right[i % right.size].toInt())
        }
        return diff == 0
    }
}
