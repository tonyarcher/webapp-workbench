package userapi.web
import userapi.http.FakeAccountStore
import userapi.http.FakeChallengeStore
import userapi.http.FakePasskeyStore
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
import userapi.accounts.PasskeyService
import userapi.accounts.buildRelyingParty
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

@WebMvcTest(AccountController::class, PasskeyController::class)
@Import(
    SecurityConfig::class,
    RequestIdFilter::class,
    AccountController::class,
    PasskeyController::class,
    ErrorAdvice::class,
)
class PasskeyRoutesTest {
    @Configuration
    class TestBeans {
        @Bean
        fun settings(): Settings = Settings(3000, "", "error", "user-api", cookieSecure = false)

        @Bean
        fun clock(): Clock = Clock.fixed(Instant.parse("2026-09-11T17:00:00Z"), ZoneOffset.UTC)

        @Bean
        fun dataSource(): DataSource = mock()

        @Bean
        fun services(settings: Settings, clock: Clock): AccountServices {
            val passkeys = FakePasskeyStore()
            val svc = PasskeyService(buildRelyingParty(settings, passkeys), passkeys, FakeChallengeStore(), clock)
            return AccountServices(
                store = FakeAccountStore(),
                hasher = PlainHasher(),
                limiter = RateLimiter(limit = 100, windowMs = 60_000L),
                clock = clock,
                passkeys = svc,
            )
        }
    }

    @Autowired
    private lateinit var mvc: MockMvc

    @Autowired
    private lateinit var mapper: ObjectMapper

    @Test
    fun registerBeginNeedsSessionAndReturnsOptions() {
        val cookies = TestCookies()
        mvc.getWithCookies(cookies, "/csrf").expectStatus(200)
        val anon = mvc.postJson(cookies, "/passkey/register/begin", csrf = true, json = null)
        assertEquals(401, anon.response.status)
        mvc.postJson(
            cookies,
            "/register",
            csrf = true,
            json = mapper.writeValueAsString(mapOf("username" to "alice", "password" to "twelvechars!!")),
        ).expectStatus(201)
        val begin = mvc.postJson(cookies, "/passkey/register/begin", csrf = true, json = null)
        begin.expectStatus(200)
        assertTrue(begin.bodyText().contains("publicKey"))
        val loginBegin = mvc.postJson(cookies, "/passkey/login/begin", csrf = true, json = null)
        loginBegin.expectStatus(200)
        assertTrue(loginBegin.bodyText().contains("publicKey"))
    }
}
