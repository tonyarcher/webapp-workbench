package userapi.domain

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PkceTest {
    @Test
    fun s256RoundTrip() {
        val verifier = "a".repeat(43)
        val challenge = pkceS256(verifier)
        assertTrue(pkceMatches(verifier, challenge))
        assertFalse(pkceMatches(verifier + "x", challenge))
        assertFalse(validCodeVerifier("short"))
    }
}
