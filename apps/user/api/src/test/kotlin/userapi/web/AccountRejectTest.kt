package userapi.web

import com.fasterxml.jackson.databind.ObjectMapper
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
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
import userapi.http.FakeAccountStore
import userapi.http.PlainHasher
import userapi.http.RateLimiter
import userapi.http.TestCookies
import userapi.http.bodyText
import userapi.http.expectStatus
import userapi.http.getWithCookies
import userapi.http.postJson

@WebMvcTest(AccountController::class, TotpController::class)
@Import(
    SecurityConfig::class,
    RequestIdFilter::class,
    AccountController::class,
    TotpController::class,
    ErrorAdvice::class,
)
class AccountRejectTest {
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
        )
    }

    @Autowired
    private lateinit var mvc: MockMvc

    @Autowired
    private lateinit var mapper: ObjectMapper

    private fun json(username: String, password: String): String =
        mapper.writeValueAsString(mapOf("username" to username, "password" to password))

    @Test
    fun registerRejectsWeak() {
        val cookies = TestCookies()
        mvc.getWithCookies(cookies, "/csrf").expectStatus(200)
        val short = mvc.postJson(cookies, "/register", csrf = true, json = json("bob", "short"))
        assertEquals(400, short.response.status)
        val badName = mvc.postJson(cookies, "/register", csrf = true, json = json("x", "twelvechars!!"))
        assertEquals(400, badName.response.status)
    }

    @Test
    fun loginUnknownUser() {
        val cookies = TestCookies()
        mvc.getWithCookies(cookies, "/csrf").expectStatus(200)
        val res = mvc.postJson(cookies, "/login", csrf = true, json = json("ghost", "twelvechars!!"))
        assertEquals(401, res.response.status)
        assertTrue(res.bodyText().contains("invalid credentials"))
        val malformed = mvc.postJson(cookies, "/login", csrf = true, json = json("x", "twelvechars!!"))
        assertEquals(401, malformed.response.status)
    }

    @Test
    fun loginTotpWithoutStore() {
        val cookies = TestCookies()
        mvc.getWithCookies(cookies, "/csrf").expectStatus(200)
        val res = mvc.postJson(
            cookies,
            "/login/totp",
            csrf = true,
            json = mapper.writeValueAsString(mapOf("code" to "123456")),
        )
        assertEquals(503, res.response.status)
    }

    @Test
    fun totpBeginWithoutStore() {
        val cookies = TestCookies()
        mvc.getWithCookies(cookies, "/csrf").expectStatus(200)
        mvc.postJson(cookies, "/register", csrf = true, json = json("hank", "twelvechars!!")).expectStatus(201)
        val res = mvc.postJson(cookies, "/totp/begin", csrf = true, json = null)
        assertEquals(503, res.response.status)
    }

    @Test
    fun totpConfirmWithoutStore() {
        val cookies = TestCookies()
        mvc.getWithCookies(cookies, "/csrf").expectStatus(200)
        mvc.postJson(cookies, "/register", csrf = true, json = json("ivan", "twelvechars!!")).expectStatus(201)
        val res = mvc.postJson(
            cookies,
            "/totp/confirm",
            csrf = true,
            json = mapper.writeValueAsString(mapOf("code" to "123456")),
        )
        assertEquals(503, res.response.status)
    }

    @Test
    fun logoutWithoutSession() {
        val cookies = TestCookies()
        mvc.getWithCookies(cookies, "/csrf").expectStatus(200)
        val res = mvc.postJson(cookies, "/logout", csrf = true, json = null)
        assertEquals(200, res.response.status)
    }

    @Test
    fun meWithoutSession() {
        val cookies = TestCookies()
        assertEquals(401, mvc.getWithCookies(cookies, "/me").response.status)
    }
}
