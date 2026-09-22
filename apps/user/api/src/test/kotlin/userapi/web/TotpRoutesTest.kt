package userapi.web
import userapi.http.AcceptingTotp
import userapi.http.FakeAccountStore
import userapi.http.FakeTotpStore
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
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Import
import org.springframework.test.web.servlet.MockMvc
import userapi.Settings
import userapi.accounts.AccountServices
import userapi.web.AccountController
import userapi.web.RequestIdFilter
import userapi.web.SecurityConfig
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
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
class TotpRoutesTest {
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
    fun enrollThenLoginRequiresCode() {
        val cookies = TestCookies()
        mvc.getWithCookies(cookies, "/csrf").expectStatus(200)
        enrollAlice(cookies)
        passwordLoginNeedsTotp(cookies)
        finishTotp(cookies)
    }

    private fun enrollAlice(cookies: TestCookies) {
        postPassword(cookies, "/register", "alice", "twelvechars!!").expectStatus(201)
        mvc.postJson(cookies, "/totp/begin", csrf = true, json = null).expectStatus(200)
        val confirm = postCode(cookies, "/totp/confirm", "123456")
        confirm.expectStatus(200)
        assertTrue(confirm.bodyText().contains("backupCodes"))
        mvc.postJson(cookies, "/logout", csrf = true, json = null).expectStatus(200)
    }

    private fun passwordLoginNeedsTotp(cookies: TestCookies) {
        val login = postPassword(cookies, "/login", "alice", "twelvechars!!")
        login.expectStatus(200)
        assertTrue(login.bodyText().contains("totpRequired"))
        assertEquals(401, mvc.getWithCookies(cookies, "/me").response.status)
    }

    private fun finishTotp(cookies: TestCookies) {
        postCode(cookies, "/login/totp", "123456").expectStatus(200)
        assertEquals(200, mvc.getWithCookies(cookies, "/me").response.status)
    }

    private fun postPassword(cookies: TestCookies, path: String, username: String, password: String) =
        mvc.postJson(
            cookies,
            path,
            csrf = true,
            json = mapper.writeValueAsString(mapOf("username" to username, "password" to password)),
        )

    private fun postCode(cookies: TestCookies, path: String, code: String) =
        mvc.postJson(
            cookies,
            path,
            csrf = true,
            json = mapper.writeValueAsString(mapOf("code" to code)),
        )
}
