package userapi.web

import org.mockito.kotlin.mock
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Import
import org.springframework.http.HttpStatus
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import userapi.Settings
import userapi.accounts.AccountServices
import userapi.accounts.OAuthService
import userapi.crypto.JwtSigner
import userapi.domain.OAuthClient
import userapi.http.FakeAccountStore
import userapi.http.FakeOAuthStore
import userapi.http.PlainHasher
import userapi.http.RateLimiter
import userapi.http.TestCookies
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import javax.sql.DataSource
import kotlin.test.Test
import kotlin.test.assertEquals

@WebMvcTest(OAuthController::class)
@Import(
    SecurityConfig::class,
    RequestIdFilter::class,
    OAuthController::class,
    ErrorAdvice::class,
)
class OAuthOfflineTest {
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

    @Test
    fun authorizeOffline() {
        val response = mvc.perform(get("/oauth/authorize")).andReturn().response
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE.value(), response.status)
    }

    @Test
    fun jwksOffline() {
        val response = mvc.perform(get("/oauth/jwks")).andReturn().response
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE.value(), response.status)
    }

    @Test
    fun tokenOffline() {
        val response = mvc.perform(post("/oauth/token")).andReturn().response
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE.value(), response.status)
    }
}

@WebMvcTest(OAuthController::class)
@Import(
    SecurityConfig::class,
    RequestIdFilter::class,
    OAuthController::class,
    ErrorAdvice::class,
)
class OAuthStorelessTest {
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
            oauthStore.putClient(OAuthClient("fitness", setOf("http://localhost/fitness/")))
            return AccountServices(
                store = null,
                hasher = PlainHasher(),
                limiter = RateLimiter(limit = 100, windowMs = 60_000L),
                clock = clock,
                oauth = OAuthService(
                    store = oauthStore,
                    signer = JwtSigner(oauthStore, "http://localhost/user-api"),
                    clock = clock,
                ),
            )
        }
    }

    @Autowired
    private lateinit var mvc: MockMvc

    @Test
    fun authorizeStoreless() {
        val response = mvc.perform(get("/oauth/authorize")).andReturn().response
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE.value(), response.status)
    }

    @Test
    fun tokenStoreless() {
        val response = mvc.perform(
            post("/oauth/token").param("grant_type", "authorization_code").param("code", "x"),
        ).andReturn().response
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE.value(), response.status)
    }
}
