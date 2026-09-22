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
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
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

@WebMvcTest(AccountController::class, TotpController::class)
@Import(
    SecurityConfig::class,
    RequestIdFilter::class,
    AccountController::class,
    TotpController::class,
    ErrorAdvice::class,
)
class TotpRejectTest {
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

    @Test
    fun confirmWrongCodeRejected() {
        val cookies = TestCookies()
        mvc.getWithCookies(cookies, "/csrf").expectStatus(200)
        register(cookies, "carol1")
        mvc.postJson(cookies, "/totp/begin", csrf = true, json = null).expectStatus(200)
        val bad = mvc.postJson(
            cookies,
            "/totp/confirm",
            csrf = true,
            json = mapper.writeValueAsString(mapOf("code" to "000000")),
        )
        bad.expectStatus(401)
        assertTrue(bad.bodyText().contains("unauthorized"))
    }

    @Test
    fun confirmWithoutBeginRejected() {
        val cookies = TestCookies()
        mvc.getWithCookies(cookies, "/csrf").expectStatus(200)
        register(cookies, "carol3")
        val res = mvc.postJson(
            cookies,
            "/totp/confirm",
            csrf = true,
            json = mapper.writeValueAsString(mapOf("code" to "123456")),
        )
        res.expectStatus(401)
    }

    @Test
    fun backupCodeLogsIn() {
        val cookies = TestCookies()
        val backup = enableTotp(cookies, "carol4")
        mvc.postJson(cookies, "/logout", csrf = true, json = null).expectStatus(200)
        mvc.postJson(
            cookies,
            "/login",
            csrf = true,
            json = mapper.writeValueAsString(mapOf("username" to "carol4", "password" to "twelvechars!!")),
        ).expectStatus(200)
        val finish = mvc.postJson(
            cookies,
            "/login/totp",
            csrf = true,
            json = mapper.writeValueAsString(mapOf("code" to backup)),
        )
        finish.expectStatus(200)
        assertEquals(200, mvc.getWithCookies(cookies, "/me").response.status)
    }

    private fun enableTotp(cookies: TestCookies, username: String): String {
        mvc.getWithCookies(cookies, "/csrf").expectStatus(200)
        register(cookies, username)
        mvc.postJson(cookies, "/totp/begin", csrf = true, json = null).expectStatus(200)
        val confirmed = mvc.postJson(
            cookies,
            "/totp/confirm",
            csrf = true,
            json = mapper.writeValueAsString(mapOf("code" to "123456")),
        )
        confirmed.expectStatus(200)
        val backup = mapper.readTree(confirmed.bodyText()).get("backupCodes")?.get(0)?.asText().orEmpty()
        assertTrue(backup.isNotEmpty())
        return backup
    }

    private fun register(cookies: TestCookies, username: String) {
        mvc.postJson(
            cookies,
            "/register",
            csrf = true,
            json = mapper.writeValueAsString(mapOf("username" to username, "password" to "twelvechars!!")),
        ).expectStatus(201)
    }
}
