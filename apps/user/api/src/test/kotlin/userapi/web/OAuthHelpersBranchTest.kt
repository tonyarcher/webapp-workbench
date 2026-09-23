package userapi.web

import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import userapi.accounts.OAuthService
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class OAuthHelpersBranchTest {
    private fun oauth(allowed: Boolean): OAuthService {
        val svc = mock<OAuthService>()
        whenever(svc.allowedRedirect("c1", "http://localhost/cb")).thenReturn(allowed)
        return svc
    }

    private fun params(): Map<String, String> = mapOf(
        "client_id" to "c1",
        "redirect_uri" to "http://localhost/cb",
        "response_type" to "code",
        "code_challenge_method" to "S256",
        "code_challenge" to "x".repeat(43),
    )

    @Test
    fun authorizeChecks() {
        assertTrue(authorizeParamsOk(oauth(true), params()))
        assertFalse(authorizeParamsOk(oauth(false), params()))
        assertFalse(authorizeParamsOk(oauth(true), params() + ("response_type" to "token")))
        assertFalse(authorizeParamsOk(oauth(true), params() + ("code_challenge_method" to "plain")))
        assertFalse(authorizeParamsOk(oauth(true), params() + ("code_challenge" to "short")))
        assertFalse(authorizeParamsOk(oauth(true), params() - "code_challenge"))
    }

    @Test
    fun loginRedirectPaths() {
        val settings = userapi.Settings(3000, "", "error", "user-api", cookieSecure = false)
        assertTrue(loginRedirect(settings, "a=1").contains("return="))
        assertTrue(loginRedirect(settings, null).endsWith("authorize"))
        assertTrue(loginRedirect(settings, "").endsWith("authorize"))
    }

    @Test
    fun redirectCodes() {
        assertEquals("http://x/cb?code=c", redirectWithCode("http://x/cb", "c", null))
        assertEquals("http://x/cb?code=c&state=s", redirectWithCode("http://x/cb", "c", "s"))
        assertEquals("http://x/cb?code=c", redirectWithCode("http://x/cb", "c", "  "))
        assertEquals("http://x/cb?a=1&code=c", redirectWithCode("http://x/cb?a=1", "c", null))
        assertEquals("http://x/cb?a=1&code=c&state=s", redirectWithCode("http://x/cb?a=1", "c", "s"))
    }

    @Test
    fun authorizeEmptyParams() {
        assertFalse(authorizeParamsOk(oauth(true), emptyMap()))
    }
}
