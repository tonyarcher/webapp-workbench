package userapi.web

import com.fasterxml.jackson.databind.ObjectMapper
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import javax.sql.DataSource
import kotlin.test.Test
import kotlin.test.assertTrue
import org.mockito.kotlin.mock
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
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
import userapi.http.FakeAccountStore
import userapi.http.FakeOAuthStore
import userapi.http.PlainHasher
import userapi.http.RateLimiter
import userapi.http.TestCookies
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
class OAuthRefreshTest {
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
    fun refreshRotatesTokens() {
        val cookies = TestCookies()
        mvc.getWithCookies(cookies, "/csrf").expectStatus(200)
        registerAlice(cookies)
        val code = authorize(cookies)
        val first = exchange(code)
        assertTrue(first.contains("refresh_token"))
        val refresh = mapper.readTree(first).get("refresh_token")?.asText().orEmpty()
        val second = refresh(refresh)
        assertTrue(second.contains("access_token"))
        val replay = refresh(refresh)
        assertTrue(replay.contains("invalid_grant"))
    }

    @Test
    fun unsupportedGrantRejected() {
        val cookies = TestCookies()
        val result = mvc.postForm(
            cookies,
            "/oauth/token",
            csrf = false,
            params = mapOf("grant_type" to "client_credentials"),
        )
        assertTrue(result.bodyText().contains("unsupported_grant_type"))
    }

    @Test
    fun badAuthorizeRejected() {
        val cookies = TestCookies()
        val query = "/oauth/authorize?response_type=code&client_id=nope&redirect_uri=http://x/" +
            "&code_challenge=$verifier&code_challenge_method=S256"
        val bad = mvc.getWithCookies(cookies, query)
        bad.expectStatus(400)
        assertTrue(bad.bodyText().contains("invalid authorize"))
    }

    @Test
    fun badVerifierRejected() {
        val cookies = TestCookies()
        mvc.getWithCookies(cookies, "/csrf").expectStatus(200)
        registerAlice(cookies, "bob")
        val code = authorize(cookies)
        val result = mvc.postForm(
            TestCookies(),
            "/oauth/token",
            csrf = false,
            params = mapOf(
                "grant_type" to "authorization_code",
                "code" to code,
                "redirect_uri" to redirect,
                "client_id" to "fitness",
                "code_verifier" to "wrong-verifier-with-43-characters-abcdefg",
            ),
        )
        assertTrue(result.bodyText().contains("invalid_grant"))
    }

    @Test
    fun unknownCodeRejected() {
        val cookies = TestCookies()
        val result = mvc.postForm(
            cookies,
            "/oauth/token",
            csrf = false,
            params = mapOf(
                "grant_type" to "authorization_code",
                "code" to "no-such-code",
                "redirect_uri" to redirect,
                "client_id" to "fitness",
                "code_verifier" to verifier,
            ),
        )
        assertTrue(result.bodyText().contains("invalid_grant"))
    }

    @Test
    fun missingFormKeysRejected() {
        val cookies = TestCookies()
        val empty = mvc.postForm(
            cookies,
            "/oauth/token",
            csrf = false,
            params = mapOf("grant_type" to "authorization_code"),
        )
        assertTrue(empty.bodyText().contains("invalid_grant"))
        val noToken = mvc.postForm(
            cookies,
            "/oauth/token",
            csrf = false,
            params = mapOf("grant_type" to "refresh_token"),
        )
        assertTrue(noToken.bodyText().contains("invalid_grant"))
    }

    @Test
    fun anonymousAuthorizeRedirects() {
        val cookies = TestCookies()
        val challenge = pkceS256(verifier)
        val result = mvc.getWithCookies(
            cookies,
            "/oauth/authorize?response_type=code&client_id=fitness&redirect_uri=$redirect" +
                "&code_challenge=$challenge&code_challenge_method=S256",
        )
        result.expectStatus(302)
        assertTrue(result.location().contains("/auth/"))
    }

    private fun registerAlice(cookies: TestCookies, username: String = "alice") {
        val created = mvc.postJson(
            cookies,
            "/register",
            csrf = true,
            json = mapper.writeValueAsString(mapOf("username" to username, "password" to "twelvechars!!")),
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

    private fun refresh(token: String): String {
        val cookies = TestCookies()
        val result = mvc.postForm(
            cookies,
            "/oauth/token",
            csrf = false,
            params = mapOf("grant_type" to "refresh_token", "refresh_token" to token),
        )
        return result.bodyText()
    }

    companion object {
        private const val REDIRECT: String = "http://localhost/fitness/"
    }
}
