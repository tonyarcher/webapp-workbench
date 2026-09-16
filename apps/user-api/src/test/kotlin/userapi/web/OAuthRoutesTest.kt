package userapi.web
import userapi.http.FakeAccountStore
import userapi.http.FakeOAuthStore
import userapi.http.PlainHasher
import userapi.http.RateLimiter
import userapi.http.TestCookies

import com.fasterxml.jackson.databind.ObjectMapper
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import javax.sql.DataSource
import org.mockito.kotlin.mock
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Import
import org.springframework.test.web.servlet.MockMvc
import userapi.Settings
import userapi.accounts.AccountServices
import userapi.accounts.OAuthService
import userapi.crypto.JwtSigner
import userapi.domain.OAuthClient
import userapi.domain.pkceS256
import userapi.web.AccountController
import userapi.web.OAuthController
import userapi.web.RequestIdFilter
import userapi.web.SecurityConfig
import kotlin.test.Test
import kotlin.test.assertTrue
import userapi.http.bodyText
import userapi.http.expectStatus
import userapi.http.getWithCookies
import userapi.http.location
import userapi.http.postForm
import userapi.http.postJson

@WebMvcTest(AccountController::class, OAuthController::class)
@Import(
    SecurityConfig::class,
    RequestIdFilter::class,
    AccountController::class,
    OAuthController::class,
    ErrorAdvice::class,
)
class OAuthRoutesTest {
    @Configuration
    class TestBeans {
        @Bean
        fun settings(): Settings = Settings(3000, "", "error", "user-api", cookieSecure = false)

        @Bean
        fun clock(): Clock = Clock.fixed(Instant.parse("2026-09-11T17:00:00Z"), ZoneOffset.UTC)

        @Bean
        fun dataSource(): DataSource = mock()

        @Bean
        fun services(clock: Clock): AccountServices {
            val oauthStore = FakeOAuthStore()
            oauthStore.putClient(OAuthClient("fitness", setOf(REDIRECT)))
            val oauth = OAuthService(
                store = oauthStore,
                signer = JwtSigner(oauthStore, "http://localhost/user-api"),
                clock = clock,
            )
            return AccountServices(
                store = FakeAccountStore(),
                hasher = PlainHasher(),
                limiter = RateLimiter(limit = 100, windowMs = 60_000L),
                clock = clock,
                oauth = oauth,
            )
        }
    }

    @Autowired
    private lateinit var mvc: MockMvc

    @Autowired
    private lateinit var mapper: ObjectMapper

    private val redirect = REDIRECT
    private val verifier = "v".repeat(43)

    @Test
    fun authorizeTokenAndRejectReplay() {
        val cookies = TestCookies()
        mvc.getWithCookies(cookies, "/v1/csrf").expectStatus(200)
        registerAlice(cookies)
        val code = authorize(cookies)
        val token = exchange(code)
        assertTrue(token.contains("access_token"))
        val replay = exchange(code)
        assertTrue(replay.contains("invalid_grant"))
    }

    private fun registerAlice(cookies: TestCookies) {
        val created = mvc.postJson(
            cookies,
            "/v1/register",
            csrf = true,
            json = mapper.writeValueAsString(mapOf("username" to "alice", "password" to "twelvechars!!")),
        )
        created.expectStatus(201)
    }

    private fun authorize(cookies: TestCookies): String {
        val challenge = pkceS256(verifier)
        val result = mvc.getWithCookies(
            cookies,
            "/oauth/authorize?response_type=code&client_id=fitness&redirect_uri=$redirect" +
                "&code_challenge=$challenge&code_challenge_method=S256&state=xyz",
        )
        result.expectStatus(302)
        val loc = result.location()
        assertTrue(loc.contains("code="))
        return loc.substringAfter("code=").substringBefore("&")
    }

    private fun exchange(code: String): String {
        val cookies = TestCookies()
        val result = mvc.postForm(
            cookies,
            "/oauth/token",
            csrf = false,
            params = mapOf(
                "grant_type" to "authorization_code",
                "code" to code,
                "redirect_uri" to redirect,
                "client_id" to "fitness",
                "code_verifier" to verifier,
            ),
        )
        return result.bodyText()
    }

    companion object {
        private const val REDIRECT: String = "http://localhost/fitness/"
    }
}
