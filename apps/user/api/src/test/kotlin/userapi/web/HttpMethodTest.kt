package userapi.web

import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.http.Cookie
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
import org.springframework.test.annotation.DirtiesContext
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import userapi.Settings
import userapi.accounts.AccountServices
import userapi.http.FakeAccountStore
import userapi.http.PlainHasher
import userapi.http.RateLimiter
import userapi.http.TestCookies
import userapi.http.expectStatus
import userapi.http.getWithCookies
import userapi.http.postJson
import userapi.http.API_VERSION
import userapi.http.API_VERSION_HEADER
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@WebMvcTest(AccountController::class)
@Import(
    SecurityConfig::class,
    RequestIdFilter::class,
    AccountController::class,
    ErrorAdvice::class,
)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class HttpMethodTest {
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
    fun wrongMethodAndMediaTypeUseJsonEnvelopes() {
        val cookies = TestCookies()
        mvc.getWithCookies(cookies, "/csrf").expectStatus(200)
        registerAlice(cookies)
        val wrongMethod = mvc.getWithCookies(cookies, "/logout")
        assertEquals(405, wrongMethod.response.status)
        assertTrue(wrongMethod.response.contentAsString.contains("\"type\":\"method\""))
        val wrongMedia = postPlain(cookies, "/register")
        assertEquals(415, wrongMedia.response.status)
        assertTrue(wrongMedia.response.contentAsString.contains("unsupported media type"))
    }

    @Test
    fun legacyVersionPrefixIsNotRouted() {
        val cookies = TestCookies()
        mvc.getWithCookies(cookies, "/csrf").expectStatus(200)
        registerAlice(cookies)
        val legacy = mvc.getWithCookies(cookies, "/v1/me")
        assertEquals(404, legacy.response.status)
    }

    @Test
    fun missingVersionHeaderIsNotRouted() {
        val cookies = TestCookies()
        mvc.getWithCookies(cookies, "/csrf").expectStatus(200)
        val unversioned = mvc.perform(
            post("/register")
                .header(CSRF_HEADER, cookies.csrf())
                .cookie(Cookie(CSRF_COOKIE, cookies.csrf()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(registerJson("alice2")),
        ).andReturn().response
        assertEquals(404, unversioned.status)
    }

    private fun registerJson(username: String = "alice"): String =
        mapper.writeValueAsString(mapOf("username" to username, "password" to "twelvechars!!"))

    private fun registerAlice(cookies: TestCookies) {
        mvc.postJson(
            cookies,
            "/register",
            csrf = true,
            json = registerJson(),
        ).expectStatus(201)
    }

    private fun postPlain(cookies: TestCookies, path: String) =
        mvc.perform(
            cookies.postWithContent(path, "plain body", MediaType.TEXT_PLAIN),
        ).andReturn().also { cookies.capture(it) }

    private fun TestCookies.postWithContent(
        path: String,
        body: String,
        mediaType: MediaType,
    ): MockHttpServletRequestBuilder {
        val builder = apply(post(path))
        builder.header(API_VERSION_HEADER, API_VERSION)
        builder.header(CSRF_HEADER, csrf())
        builder.contentType(mediaType)
        builder.content(body)
        return builder
    }
}
