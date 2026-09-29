package userapi.web

import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Import
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import userapi.Settings
import userapi.accounts.AccountServices
import userapi.accounts.OAuthService
import userapi.crypto.JwtSigner
import userapi.domain.OAuthClient
import userapi.http.FakeAccountStore
import userapi.http.FakeOAuthStore
import userapi.http.PlainHasher
import userapi.http.RateLimiter
import userapi.settingsForTest
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import javax.sql.DataSource
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get as getRequest

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
        fun services(clock: Clock): AccountServices {
            val oauthStore = FakeOAuthStore()
            oauthStore.putClient(OAuthClient("gitea", setOf(CALLBACK)))
            val oauth = OAuthService(oauthStore, JwtSigner(oauthStore, ISSUER), clock)
            return AccountServices(
                store = FakeAccountStore(),
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
        // No id_token is issued anywhere, so claiming a signing algorithm would
        // be a claim a client could reasonably rely on.
        assertTrue(
            doc["id_token_signing_alg_values_supported"] == null,
            "no id_token is issued, so none is advertised",
        )
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

    private companion object {
        const val ISSUER = "http://localhost/user-api"
        const val CALLBACK = "http://gateway.example/git/user/oauth2/user-api/callback"
        const val DISCOVERY_PATH = "/.well-known/openid-configuration"
        const val USERINFO_PATH = "/oauth/userinfo"
        val NOW: Instant = Instant.parse("2026-09-29T12:00:00Z")
        val USER_ID: UUID = UUID.fromString("11111111-1111-1111-1111-111111111111")
    }
}
