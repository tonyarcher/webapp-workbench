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

@WebMvcTest(AccountController::class)
@Import(
    SecurityConfig::class,
    RequestIdFilter::class,
    AccountController::class,
    ErrorAdvice::class,
)
class AccountLockoutTest {
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
    fun repeatedFailuresLockAccount() {
        val cookies = TestCookies()
        mvc.getWithCookies(cookies, "/csrf").expectStatus(200)
        mvc.postJson(cookies, "/register", csrf = true, json = json("dave", "twelvechars!!")).expectStatus(201)
        repeat(5) {
            val wrong = mvc.postJson(cookies, "/login", csrf = true, json = json("dave", "wrongpassword1"))
            assertEquals(401, wrong.response.status)
        }
        val locked = mvc.postJson(cookies, "/login", csrf = true, json = json("dave", "twelvechars!!"))
        assertEquals(401, locked.response.status)
        assertTrue(locked.bodyText().contains("invalid credentials"))
    }

    @Test
    fun unknownUserNeverLocks() {
        val cookies = TestCookies()
        mvc.getWithCookies(cookies, "/csrf").expectStatus(200)
        repeat(3) {
            val res = mvc.postJson(cookies, "/login", csrf = true, json = json("nobody", "twelvechars!!"))
            assertEquals(401, res.response.status)
        }
    }
}
