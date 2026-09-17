package userapi.web

import com.fasterxml.jackson.databind.ObjectMapper
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import javax.sql.DataSource
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.mockito.kotlin.mock
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Import
import org.springframework.test.web.servlet.MockMvc
import userapi.Settings
import userapi.accounts.AccountServices
import userapi.http.AcceptingTotp
import userapi.http.FakeAccountStore
import userapi.http.FakeTotpStore
import userapi.http.PlainHasher
import userapi.http.RateLimiter
import userapi.http.TestCookies
import userapi.http.bodyText
import userapi.http.expectStatus
import userapi.http.getWithCookies
import userapi.http.postJson

@WebMvcTest(AccountController::class)
@Import(
    SecurityConfig::class,
    RequestIdFilter::class,
    AccountController::class,
    ErrorAdvice::class,
)
class AccountTotpTest {
    @Configuration
    class TestBeans {
        @Bean
        fun settings(): Settings = Settings(3000, "", "error", "user-api", cookieSecure = false)

        @Bean
        fun clock(): Clock = Clock.fixed(Instant.parse("2026-09-11T17:00:00Z"), ZoneOffset.UTC)

        @Bean
        fun dataSource(): DataSource = mock()

        @Bean
        fun services(clock: Clock): AccountServices = AccountServices(
            store = FakeAccountStore(),
            hasher = PlainHasher(),
            limiter = RateLimiter(limit = 100, windowMs = 60_000L),
            clock = clock,
            totpStore = FakeTotpStore(),
            totp = AcceptingTotp(),
        )
    }

    @Autowired
    private lateinit var mvc: MockMvc

    @Autowired
    private lateinit var mapper: ObjectMapper

    @Autowired
    private lateinit var accounts: AccountServices

    private fun json(username: String, password: String): String =
        mapper.writeValueAsString(mapOf("username" to username, "password" to password))

    private fun userIdOf(username: String): UUID =
        (accounts.store as FakeAccountStore).findByUsername(username)?.id ?: error("missing user")

    @Test
    fun loginWithTotpEnabledChallenges() {
        val cookies = TestCookies()
        mvc.getWithCookies(cookies, "/csrf").expectStatus(200)
        mvc.postJson(cookies, "/register", csrf = true, json = json("erin", "twelvechars!!")).expectStatus(201)
        val uid = userIdOf("erin")
        (accounts.totpStore as FakeTotpStore).enableSecret(uid, "TESTSECRETBASE32")
        val login = mvc.postJson(cookies, "/login", csrf = true, json = json("erin", "twelvechars!!"))
        assertEquals(200, login.response.status)
        assertTrue(login.bodyText().contains("totpRequired"))
        val finish = mvc.postJson(
            cookies,
            "/login/totp",
            csrf = true,
            json = mapper.writeValueAsString(mapOf("code" to "123456")),
        )
        assertEquals(200, finish.response.status)
    }

    @Test
    fun loginTotpBadCodeLocksOut() {
        val cookies = TestCookies()
        mvc.getWithCookies(cookies, "/csrf").expectStatus(200)
        mvc.postJson(cookies, "/register", csrf = true, json = json("frank", "twelvechars!!")).expectStatus(201)
        val uid = userIdOf("frank")
        (accounts.totpStore as FakeTotpStore).enableSecret(uid, "TESTSECRETBASE32")
        mvc.postJson(cookies, "/login", csrf = true, json = json("frank", "twelvechars!!")).expectStatus(200)
        val bad = mvc.postJson(
            cookies,
            "/login/totp",
            csrf = true,
            json = mapper.writeValueAsString(mapOf("code" to "000000")),
        )
        assertEquals(401, bad.response.status)
    }

    @Test
    fun loginTotpBogusChallenge() {
        val cookies = TestCookies()
        mvc.getWithCookies(cookies, "/csrf").expectStatus(200)
        mvc.postJson(cookies, "/register", csrf = true, json = json("gina", "twelvechars!!")).expectStatus(201)
        val res = mvc.postJson(
            cookies,
            "/login/totp",
            csrf = true,
            json = mapper.writeValueAsString(mapOf("code" to "123456")),
        )
        assertEquals(401, res.response.status)
    }

    @Test
    fun loginTotpUnknownChallenge() {
        val cookies = TestCookies()
        mvc.getWithCookies(cookies, "/csrf").expectStatus(200)
        mvc.postJson(cookies, "/register", csrf = true, json = json("hank", "twelvechars!!")).expectStatus(201)
        val uid = userIdOf("hank")
        (accounts.totpStore as FakeTotpStore).enableSecret(uid, "TESTSECRETBASE32")
        mvc.postJson(cookies, "/login", csrf = true, json = json("hank", "twelvechars!!")).expectStatus(200)
        cookies.put(PENDING_COOKIE, "bogus-pending-token")
        val res = mvc.postJson(
            cookies,
            "/login/totp",
            csrf = true,
            json = mapper.writeValueAsString(mapOf("code" to "123456")),
        )
        assertEquals(401, res.response.status)
    }

    @Test
    fun lockedUserCannotFinishTotp() {
        val cookies = TestCookies()
        mvc.getWithCookies(cookies, "/csrf").expectStatus(200)
        mvc.postJson(cookies, "/register", csrf = true, json = json("ivan", "twelvechars!!")).expectStatus(201)
        val uid = userIdOf("ivan")
        (accounts.totpStore as FakeTotpStore).enableSecret(uid, "TESTSECRETBASE32")
        mvc.postJson(cookies, "/login", csrf = true, json = json("ivan", "twelvechars!!")).expectStatus(200)
        repeat(5) {
            mvc.postJson(cookies, "/login", csrf = true, json = json("ivan", "wrongpassword1"))
        }
        val finish = mvc.postJson(
            cookies,
            "/login/totp",
            csrf = true,
            json = mapper.writeValueAsString(mapOf("code" to "123456")),
        )
        assertEquals(401, finish.response.status)
    }
}
