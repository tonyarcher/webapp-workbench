package userapi.web

import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.mock.web.MockHttpServletResponse
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import userapi.Settings
import userapi.accounts.AccountServices
import userapi.accounts.OAuthService
import userapi.crypto.JwtSigner
import userapi.domain.OAuthClient
import userapi.domain.sha256Hex
import userapi.http.FakeAccountStore
import userapi.http.FakeOAuthStore
import userapi.http.PlainHasher
import userapi.http.RateLimiter
import userapi.settingsForTest
import java.security.MessageDigest
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.Base64
import java.util.UUID
import javax.sql.DataSource
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get as getRequest
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post as postRequest

/**
 * Gitea's OpenID Connect source fetches discovery and then reads the signed-in
 * identity from userinfo, so both are load-bearing for a sign-in a browser has
 * to finish. Neither endpoint existed before.
 */
@WebMvcTest(OAuthController::class, OidcController::class)
@Import(
    SecurityConfig::class,
    RequestIdFilter::class,
    OAuthController::class,
    OidcController::class,
    ErrorAdvice::class,
)
class OidcDiscoveryTest {
    @Configuration
    class TestBeans {
        @Bean
        fun mapper(): ObjectMapper = ObjectMapper()

        // The two bases differ here on purpose, mirroring the deployment. A test
        // where they match cannot tell them apart, and publishing one base for
        // every endpoint is exactly the mistake this pins.
        @Bean
        fun settings(): Settings = settingsForTest(
            publicBase = "http://gateway.example/user-api",
            internalBase = "http://user-api:3000",
        )

        @Bean
        fun clock(): Clock = Clock.fixed(NOW, ZoneOffset.UTC)

        @Bean
        fun dataSource(): DataSource = mock()

        @Bean
        fun accountStore(): FakeAccountStore = FakeAccountStore()

        @Bean
        fun oauthStore(): FakeOAuthStore = FakeOAuthStore().apply {
            putClient(OAuthClient("gitea", setOf(CALLBACK)))
        }

        @Bean
        fun services(clock: Clock, accountStore: FakeAccountStore, oauthStore: FakeOAuthStore): AccountServices {
            val oauth = OAuthService(oauthStore, JwtSigner(oauthStore, ISSUER), clock)
            return AccountServices(
                store = accountStore,
                hasher = PlainHasher(),
                limiter = testLimiter(limit = 100),
                clock = clock,
                oauth = oauth,
            )
        }
    }

    @Autowired
    lateinit var mvc: MockMvc

    @Autowired
    lateinit var services: AccountServices

    @Autowired
    lateinit var accountStore: FakeAccountStore

    @Autowired
    lateinit var json: ObjectMapper

    private fun token(issuedAt: Instant = NOW): String =
        requireNotNull(services.oauth).signer.accessToken(USER_ID, "tony", "gitea", issuedAt)

    private fun discovery() = mvc.perform(getRequest(DISCOVERY_PATH))
        .andReturn().response.contentAsString

    private fun userinfo(authorization: String?) = mvc.perform(
        getRequest(USERINFO_PATH).apply {
            if (authorization != null) {
                header("Authorization", authorization)
            }
        },
    ).andReturn().response

    @Test
    fun `discovery is public and names both bases`() {
        val response = mvc.perform(getRequest(DISCOVERY_PATH)).andReturn().response
        assertEquals(200, response.status, "discovery must be readable before a client has any credential")
        val doc = json.readTree(response.contentAsString)
        assertEquals(ISSUER, doc["issuer"].asText())
        // Browser-facing, so the gateway prefix is still on it.
        assertEquals(
            "http://gateway.example/user-api/oauth/authorize",
            doc["authorization_endpoint"].asText(),
        )
        // Server-to-server, so the prefix is gone: the gateway strips it and the
        // service name is not routable from a browser.
        assertEquals("http://user-api:3000/oauth/token", doc["token_endpoint"].asText())
        assertEquals("http://user-api:3000/oauth/userinfo", doc["userinfo_endpoint"].asText())
        assertEquals("http://user-api:3000/oauth/jwks", doc["jwks_uri"].asText())
    }

    @Test
    fun `discovery advertises only the flows this service implements`() {
        val doc = json.readTree(discovery())
        assertEquals(listOf("code"), doc["response_types_supported"].map { it.asText() })
        assertEquals(listOf("S256"), doc["code_challenge_methods_supported"].map { it.asText() })
        // An id_token IS issued, so the signing alg is advertised. This asserted
        // the opposite while none was, and the absence was the bug: goth's
        // openidConnect client will not complete a login without one.
        assertEquals(
            listOf("RS256"),
            doc["id_token_signing_alg_values_supported"].map { it.asText() },
        )
        // No scope-specific claims are issued, so naming scopes would describe a
        // feature that is not there.
        assertTrue(doc["scopes_supported"] == null, "no scopes_supported is invented")
    }

    @Test
    fun `userinfo returns the claims for a valid access token`() {
        val response = userinfo("Bearer " + token())
        assertEquals(200, response.status)
        val body = json.readTree(response.contentAsString)
        assertEquals(USER_ID.toString(), body["sub"].asText())
        assertEquals("tony", body["preferred_username"].asText())
        assertEquals("tony", body["name"].asText())
        assertTrue(body["email"] == null, "accounts have no address, so none is invented")
    }

    @Test
    fun `userinfo without a token is unauthorized`() {
        assertEquals(401, userinfo(null).status)
    }

    @Test
    fun `userinfo with a garbage token is unauthorized`() {
        assertEquals(401, userinfo("Bearer not-a-jwt").status)
    }

    @Test
    fun `userinfo rejects a non-bearer scheme, so a cookie is not interchangeable`() {
        assertEquals(401, userinfo("Basic " + token()).status)
    }

    @Test
    fun `userinfo rejects an expired token`() {
        val stale = token(NOW.minusSeconds(4000))
        assertEquals(401, userinfo("Bearer " + stale).status)
    }

    /**
     * The nonce round trip, which is the second thing that stops an OIDC login.
     *
     * A conforming client passes the nonce it sent to /oauth/authorize as
     * `expectedNonce` when it verifies the id_token, and refuses a token that
     * does not carry the same value. user-api used to drop the parameter
     * entirely, so the token could not possibly match. The id_token is read
     * here rather than the signer being called directly, because the claim has
     * to survive the code store.
     */
    @Test
    fun `a redeemed code echoes the nonce into the id_token`() {
        val idToken = redeemWithNonce(NONCE)
        assertEquals(NONCE, jwtClaim(idToken, "nonce"), "OIDC Core 3.1.3.7 requires the echo")
    }

    /**
     * And when the client sent none, the claim must be absent rather than empty,
     * so a client that asked for nothing is not handed something.
     */
    @Test
    fun `no nonce in the request means no nonce claim`() {
        val idToken = redeemWithNonce("")
        assertNull(jwtClaim(idToken, "nonce"), "an unsolicited nonce claim is a claim invented")
    }

    /** Redeem a code stored with [nonce] and return the id_token it produced. */
    private fun redeemWithNonce(nonce: String): String {
        val response = redeemPkceCode(nonce)
        assertEquals(200, response.status, response.contentAsString)
        return requireNotNull(json.readTree(response.contentAsString)["id_token"]?.asText())
    }

    /**
     * The specific thing that stopped a Gitea login: goth's openidConnect
     * provider returns "cannot get user information without id_token" before it
     * consults anything else, so a token response without one cannot sign
     * anyone in.
     *
     * A real code is redeemed here rather than a synthetic one. Asserting only
     * that the endpoint answers 400 or 200 would pass with or without the
     * id_token and prove nothing, which is the failure this test exists to stop
     * repeating.
     */
    @Test
    fun `a redeemed code returns an id_token`() {
        val response = redeemPkceCode()
        assertEquals(
            200,
            response.status,
            "a valid PKCE exchange must succeed, got ${response.contentAsString}",
        )
        val body = json.readTree(response.contentAsString)
        assertNotNull(body["access_token"]?.asText(), "access_token")
        val idToken = body["id_token"]?.asText()
        assertNotNull(idToken, "goth refuses a login whose response carries no id_token")

        // Present is not enough: goth also checks the claims before it trusts it.
        val claims = requireNotNull(services.oauth).signer.verifyAccessToken(idToken, NOW)
        assertNotNull(claims, "the id_token must verify against our own published key")
        assertEquals("gitea", claims.clientId, "aud must be the client id, which goth checks")
        assertEquals(ISSUER, jwtClaim(idToken, "iss"), "iss must be the discovery issuer")
        assertEquals(VERIFIER_USER_ID.get().toString(), claims.subject, "sub is the account id")
    }

    /**
     * Store a real authorization code and exchange it, returning the response.
     *
     * The exchange resolves the account's username before it issues anything,
     * so a code for a user that does not exist is refused before the id_token is
     * ever built. The id the fake account store hands out is therefore recorded
     * in VERIFIER_USER_ID for the caller to assert against.
     */
    private fun redeemPkceCode(nonce: String = ""): MockHttpServletResponse {
        val store = requireNotNull(services.oauth).store as FakeOAuthStore
        // Unique per call: the fake refuses a duplicate username, and several
        // tests redeem a code against the same store.
        val userId = requireNotNull(accountStore.createUser("tony-${USER_SEQ.incrementAndGet()}", "hash"))
        VERIFIER_USER_ID.set(userId)
        store.insertAuthCode(
            codeHash = sha256Hex(CODE),
            userId = userId,
            clientId = "gitea",
            redirectUri = CALLBACK,
            // PKCE: the stored challenge is the S256 of the verifier sent below.
            codeChallenge = s256(VERIFIER),
            expiresAt = NOW.plusSeconds(300),
            nonce = nonce,
        )
        return mvc.perform(
            postRequest(TOKEN_PATH).apply {
                header("X-CSRF-Token", "t")
                contentType(MediaType.APPLICATION_FORM_URLENCODED)
                content(
                    "grant_type=authorization_code&code=$CODE&client_id=gitea" +
                        "&redirect_uri=$CALLBACK&code_verifier=$VERIFIER",
                )
            },
        ).andReturn().response
    }

    @Test
    fun `an id_token names the client and the discovery issuer`() {
        val signer = requireNotNull(services.oauth).signer
        val idToken = signer.identityToken(USER_ID, "tony", "gitea", NOW)
        val claims = signer.verifyAccessToken(idToken, NOW)
        assertNotNull(claims, "an id_token must verify against our own key")
        assertEquals(USER_ID.toString(), claims.subject)
        assertEquals("gitea", claims.clientId, "aud must be the client id, which goth checks")
        assertEquals(ISSUER, jwtClaim(idToken, "iss"), "iss must be the discovery issuer")
        assertEquals("tony", claims.username)
    }

    private companion object {
        const val ISSUER = "http://localhost/user-api"
        const val CALLBACK = "http://gateway.example/git/user/oauth2/user-api/callback"
        const val DISCOVERY_PATH = "/.well-known/openid-configuration"
        const val USERINFO_PATH = "/oauth/userinfo"
        const val TOKEN_PATH = "/oauth/token"
        const val CODE = "a-real-authorization-code"
        const val VERIFIER = "a-verifier-long-enough-to-be-accepted-0123456789"
        const val NONCE = "n-0S6_WzA2Mj"
        val NOW: Instant = Instant.parse("2026-09-29T12:00:00Z")
        val USER_ID: UUID = UUID.fromString("11111111-1111-1111-1111-111111111111")

        /** The id the account fake assigned, which the exchange must echo as `sub`. */
        val VERIFIER_USER_ID = java.util.concurrent.atomic.AtomicReference<UUID>()

        /** Usernames must be unique; the fake store refuses a duplicate. */
        val USER_SEQ = java.util.concurrent.atomic.AtomicInteger()

        /** The PKCE S256 transform, base64url without padding, as RFC 7636 defines it. */
        fun s256(verifier: String): String = Base64.getUrlEncoder().withoutPadding()
            .encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray()))

        /**
         * Read one claim out of a signed token.
         *
         * `verifyAccessToken` returns an AccessClaims, which carries no issuer,
         * and the issuer is exactly what an OIDC client compares against. So it
         * is read from the token that will actually be sent, rather than from a
         * projection that happens to drop it.
         */
        fun jwtClaim(jwt: String, name: String): String? {
            val payload = jwt.split('.')[1]
            val json = ObjectMapper().readTree(
                String(Base64.getUrlDecoder().decode(payload), Charsets.UTF_8),
            )
            return json[name]?.takeIf { it.isTextual }?.asText()
        }
    }
}
