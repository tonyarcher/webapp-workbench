package userapi.domain

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class OAuthClientTest {
    @Test
    fun redirectMustMatchExactly() {
        val client = OAuthClient("fitness", setOf("http://localhost/fitness/"))
        assertTrue(redirectAllowed(client, "http://localhost/fitness/"))
        assertFalse(redirectAllowed(client, "http://localhost/fitness"))
        assertFalse(redirectAllowed(client, "http://evil.example/fitness/"))
    }
}
