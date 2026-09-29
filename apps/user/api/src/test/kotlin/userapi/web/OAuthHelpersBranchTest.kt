package userapi.web
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import userapi.accounts.OAuthService
import userapi.domain.ClientSecrets
import userapi.settingsForTest
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

    /** No client in this map is confidential, so every one must use PKCE. */
    private val public: ClientSecrets = ClientSecrets(emptyMap())

    /** A digest of anything; only its presence makes a client confidential here. */
    private val confidential: ClientSecrets = ClientSecrets(mapOf("c1" to "0".repeat(64)))

    @Test
    fun authorizeChecks() {
        assertTrue(authorizeParamsOk(oauth(true), params(), public))
        assertFalse(authorizeParamsOk(oauth(false), params(), public))
        assertFalse(authorizeParamsOk(oauth(true), params() + ("response_type" to "token"), public))
        assertFalse(authorizeParamsOk(oauth(true), params() + ("code_challenge_method" to "plain"), public))
        assertFalse(authorizeParamsOk(oauth(true), params() + ("code_challenge" to "short"), public))
        assertFalse(authorizeParamsOk(oauth(true), params() - "code_challenge", public))
    }

    /**
     * A confidential client may omit PKCE -- Gitea cannot send it, and its fix is
     * an unmerged PR. This is the only way a non-PKCE authorize is accepted.
     */
    @Test
    fun aConfidentialClientMayOmitPkce() {
        assertTrue(
            authorizeParamsOk(
                oauth(true),
                params() - "code_challenge" -
                    "code_challenge_method",
                confidential,
            ),
        )
    }

    /** A public client may not, however it asks. */
    @Test
    fun aPublicClientStillMayNotOmitPkce() {
        assertFalse(
            authorizeParamsOk(
                oauth(true),
                params() - "code_challenge" -
                    "code_challenge_method",
                public,
            ),
        )
    }

    /** Confidentiality does not waive the redirect or response_type checks. */
    @Test
    fun aConfidentialClientIsStillBoundByRedirectAndResponseType() {
        assertFalse(authorizeParamsOk(oauth(false), params(), confidential))
        assertFalse(authorizeParamsOk(oauth(true), params() + ("response_type" to "token"), confidential))
    }

    @Test
    fun hasPkceDependsOnlyOnTheRequest() {
        assertTrue(hasPkce(params()))
        assertFalse(hasPkce(params() - "code_challenge"))
        assertFalse(hasPkce(params() - "code_challenge_method"))
        assertFalse(hasPkce(params() + ("code_challenge" to "short")))
    }

    @Test
    fun loginRedirectPaths() {
        val settings = userapi.settingsForTest(cookieSecure = false)
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
        assertFalse(authorizeParamsOk(oauth(true), emptyMap(), public))
    }
}
