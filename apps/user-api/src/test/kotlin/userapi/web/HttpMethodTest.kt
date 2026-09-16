package userapi.web

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
        mvc.getWithCookies(cookies, "/v1/csrf").expectStatus(200)
        registerAlice(cookies)
        val wrongMethod = mvc.getWithCookies(cookies, "/v1/logout")
        assertEquals(405, wrongMethod.response.status)
        assertTrue(wrongMethod.response.contentAsString.contains("\"type\":\"method\""))
        val wrongMedia = postPlain(cookies, "/v1/register")
        assertEquals(415, wrongMedia.response.status)
        assertTrue(wrongMedia.response.contentAsString.contains("unsupported media type"))
    }

    private fun registerAlice(cookies: TestCookies) {
        mvc.postJson(
            cookies,
            "/v1/register",
            csrf = true,
            json = mapper.writeValueAsString(mapOf("username" to "alice", "password" to "twelvechars!!")),
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
        builder.header(CSRF_HEADER, csrf())
        builder.contentType(mediaType)
        builder.content(body)
        return builder
    }
}
