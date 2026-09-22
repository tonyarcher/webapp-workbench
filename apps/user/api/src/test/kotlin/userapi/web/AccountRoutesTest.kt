package userapi.web
import userapi.http.FakeAccountStore
import userapi.http.PlainHasher
import userapi.http.RateLimiter
import userapi.http.TestCookies

import com.fasterxml.jackson.databind.ObjectMapper
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Import
import org.springframework.test.annotation.DirtiesContext
import org.springframework.test.web.servlet.MockMvc
import userapi.Settings
import userapi.accounts.AccountServices
import userapi.web.AccountController
import userapi.web.RequestIdFilter
import userapi.web.SecurityConfig
import javax.sql.DataSource
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.mockito.kotlin.mock
import userapi.http.bodyText
import userapi.http.csrfToken
import userapi.http.expectStatus
import userapi.http.getWithCookies
import userapi.http.postJson

@WebMvcTest(AccountController::class, TotpController::class, PasskeyController::class)
@Import(
    SecurityConfig::class,
    RequestIdFilter::class,
    AccountController::class,
    TotpController::class,
    PasskeyController::class,
    ErrorAdvice::class,
)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class AccountRoutesTest {
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

    @Test
    fun registerLoginMeLogout() {
        val cookies = TestCookies()
        fetchCsrf(cookies)
        registerAlice(cookies)
        assertMeContainsAlice(cookies)
        logoutAndAssertUnauthorized(cookies)
        loginAlice(cookies)
        assertMeOk(cookies)
    }

    @Test
    fun csrfRequiredAndBadPassword() {
        val cookies = TestCookies()
        fetchCsrf(cookies)
        registerAlice(cookies)
        val missing = mvc.postJson(cookies, "/login", csrf = false, json = loginJson())
        assertEquals(403, missing.response.status)
        val wrong = mvc.postJson(
            cookies,
            "/login",
            csrf = true,
            json = mapper.writeValueAsString(mapOf("username" to "alice", "password" to "wrong-password-long")),
        )
        assertEquals(401, wrong.response.status)
        assertTrue(wrong.bodyText().contains("invalid credentials"))
    }

    @Test
    fun duplicateUsernameConflict() {
        val cookies = TestCookies()
        fetchCsrf(cookies)
        registerAlice(cookies)
        val dup = mvc.postJson(cookies, "/register", csrf = true, json = registerJson("otherpassword1"))
        assertEquals(409, dup.response.status)
    }

    private fun fetchCsrf(cookies: TestCookies): String {
        val result = mvc.getWithCookies(cookies, "/csrf")
        result.expectStatus(200)
        return result.csrfToken(mapper)
    }

    private fun registerAlice(cookies: TestCookies) {
        val created = mvc.postJson(cookies, "/register", csrf = true, json = registerJson())
        assertEquals(201, created.response.status)
    }

    private fun registerJson(password: String = "twelvechars!!"): String =
        mapper.writeValueAsString(mapOf("username" to "alice", "password" to password))

    private fun loginJson(): String = registerJson()

    private fun assertMeContainsAlice(cookies: TestCookies) {
        val me = mvc.getWithCookies(cookies, "/me")
        assertEquals(200, me.response.status)
        assertTrue(me.bodyText().contains("alice"))
    }

    private fun logoutAndAssertUnauthorized(cookies: TestCookies) {
        val loggedOut = mvc.postJson(cookies, "/logout", csrf = true, json = null)
        assertEquals(200, loggedOut.response.status)
        assertEquals(401, mvc.getWithCookies(cookies, "/me").response.status)
    }

    private fun loginAlice(cookies: TestCookies) {
        val login = mvc.postJson(cookies, "/login", csrf = true, json = loginJson())
        assertEquals(200, login.response.status)
    }

    private fun assertMeOk(cookies: TestCookies) {
        assertEquals(200, mvc.getWithCookies(cookies, "/me").response.status)
    }
}
