package timesupapi.usage
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.TestPropertySource
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post
import timesupapi.platform.RequestIdFilter
import timesupapi.platform.SecurityConfig

@WebMvcTest(UsageController::class)
@TestPropertySource(properties = ["USAGE_ENABLED=1"])
@Import(SecurityConfig::class, RequestIdFilter::class, UsageControllerTest.EnabledConfig::class)
class UsageControllerTest {
    @TestConfiguration
    class EnabledConfig {
        @Bean
        fun usageEnabled(): UsageEnabled = UsageEnabled(true)
    }

    @Autowired
    lateinit var mvc: MockMvc

    @MockitoBean
    lateinit var decoder: JwtDecoder

    @MockitoBean
    lateinit var repo: FeatureUsageRepo

    @MockitoBean
    lateinit var rateLimiter: UsageRateLimiter

    @BeforeEach
    fun allowRate() {
        whenever(decoder.decode(any())).thenReturn(
            Jwt.withTokenValue("tok")
                .header("alg", "RS256")
                .claim("sub", "u1")
                .claim("aud", listOf("times-up"))
                .build(),
        )
        whenever(rateLimiter.allow(any(), any())).thenReturn(true)
    }

    @Test
    fun requiresAuthenticationWhenEnabled() {
        mvc.post("/usage") {
            header("X-Api-Version", "1")
            contentType = MediaType.APPLICATION_JSON
            content = """{"events":[]}"""
        }.andExpect { status { isUnauthorized() } }
        verify(repo, never()).increment(any(), any(), any())
    }

    @Test
    fun recordsValidBatch() {
        mvc.post("/usage") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"events":[{"feature":"tab_opened","count":2},{"feature":"body_loaded","count":1}]}"""
        }.andExpect {
            status { isOk() }
            jsonPath("$.ok") { value(true) }
        }
        verify(repo).increment(eq("tab_opened"), any(), eq(2L))
        verify(repo).increment(eq("body_loaded"), any(), eq(1L))
    }

    @Test
    fun rejectsUnknownFeature() {
        mvc.post("/usage") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"events":[{"feature":"steal_passwords","count":1}]}"""
        }.andExpect {
            status { isBadRequest() }
        }
        verify(repo, never()).increment(any(), any(), any())
    }

    @Test
    fun rejectsMissingFeature() {
        mvc.post("/usage") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"events":[{"count":1}]}"""
        }.andExpect { status { isBadRequest() } }
    }

    @Test
    fun rejectsBlankFeature() {
        mvc.post("/usage") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"events":[{"feature":"  ","count":1}]}"""
        }.andExpect { status { isBadRequest() } }
    }

    @Test
    fun rejectsInvalidCount() {
        mvc.post("/usage") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"events":[{"feature":"tab_opened","count":0}]}"""
        }.andExpect {
            status { isBadRequest() }
        }
    }

    @Test
    fun rejectsOversizedBatch() {
        val events = (1..51).joinToString(",") { """{"feature":"tab_opened","count":1}""" }
        mvc.post("/usage") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"events":[$events]}"""
        }.andExpect {
            status { isBadRequest() }
        }
    }

    @Test
    fun emptyBatchIsOk() {
        mvc.post("/usage") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"events":[]}"""
        }.andExpect { status { isOk() } }
        verify(repo, never()).increment(any(), any(), any())
    }

    @Test
    fun rejectsCountAboveMax() {
        mvc.post("/usage") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"events":[{"feature":"tab_opened","count":1001}]}"""
        }.andExpect { status { isBadRequest() } }
        verify(repo, never()).increment(any(), any(), any())
    }

    @Test
    fun rejectsMissingCount() {
        mvc.post("/usage") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"events":[{"feature":"tab_opened"}]}"""
        }.andExpect { status { isBadRequest() } }
    }

    @Test
    fun sumsSameFeature() {
        mvc.post("/usage") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"events":[{"feature":"tab_opened","count":2},{"feature":"tab_opened","count":3}]}"""
        }.andExpect { status { isOk() } }
        verify(repo).increment(eq("tab_opened"), any(), eq(5L))
    }

    @Test
    fun rejectsMissingEvents() {
        mvc.post("/usage") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{}"""
        }.andExpect { status { isBadRequest() } }
    }

    @Test
    fun rejectsWhenRateLimited() {
        whenever(rateLimiter.allow(any(), any())).thenReturn(false)
        mvc.post("/usage") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"events":[{"feature":"tab_opened","count":1}]}"""
        }.andExpect { status { isTooManyRequests() } }
        verify(repo, never()).increment(any(), any(), any())
    }
}

@WebMvcTest(UsageController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, UsageControllerDisabledTest.DisabledConfig::class)
class UsageControllerDisabledTest {
    @TestConfiguration
    class DisabledConfig {
        @Bean
        fun usageEnabled(): UsageEnabled = UsageEnabled(false)
    }

    @Autowired
    lateinit var mvc: MockMvc

    @MockitoBean
    lateinit var decoder: JwtDecoder

    @MockitoBean
    lateinit var repo: FeatureUsageRepo

    @MockitoBean
    lateinit var rateLimiter: UsageRateLimiter

    @BeforeEach
    fun allowRate() {
        whenever(rateLimiter.allow(any(), any())).thenReturn(true)
    }

    @Test
    fun returns404WhenDisabled() {
        mvc.post("/usage") {
            header("X-Api-Version", "1")
            contentType = MediaType.APPLICATION_JSON
            content = """{"events":[{"feature":"tab_opened","count":1}]}"""
        }.andExpect {
            status { isNotFound() }
        }
        verify(repo, never()).increment(any(), any(), any())
    }
}
