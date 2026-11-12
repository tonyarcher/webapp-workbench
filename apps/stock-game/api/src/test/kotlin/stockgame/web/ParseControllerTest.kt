package stockgame.web

import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post
import stockgame.ai.AiConfig
import stockgame.ai.AiQuotaService
import stockgame.parse.OrderParseProvider
import stockgame.parse.ParsedOrder
import stockgame.persist.UserRepo
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@WebMvcTest(ParseController::class)
@Import(TestApiConfig::class, RequestIdFilter::class, SecurityConfig::class, IdentityUser::class)
class ParseControllerTest {
    @Autowired
    lateinit var mvc: MockMvc

    @MockitoBean
    lateinit var decoder: JwtDecoder

    @MockitoBean
    lateinit var users: UserRepo

    @MockitoBean
    lateinit var aiConfig: AiConfig

    @MockitoBean
    lateinit var quotas: AiQuotaService

    @MockitoBean
    lateinit var provider: OrderParseProvider

    private fun auth() {
        val uid = UUID.randomUUID()
        whenever(decoder.decode(any())).thenReturn(
            Jwt.withTokenValue("tok")
                .header("alg", "RS256")
                .claim("sub", "u1")
                .claim("preferred_username", "u1")
                .claim("aud", listOf("stock-game"))
                .build(),
        )
        stubUser(users, "u1", uid)
    }

    private fun postParse(text: String): String = postParseRaw("""{"text":"$text"}""")

    private fun postParseRaw(payload: String) = mvc.post("/orders/parse") {
        header("X-Api-Version", "1")
        header("Authorization", "Bearer t")
        contentType = MediaType.APPLICATION_JSON
        content = payload
    }.andReturn().response.contentAsString

    @Test
    fun disabledProviderReturnsCodeOnly() {
        auth()
        whenever(aiConfig.provider).thenReturn("")
        whenever(aiConfig.decisionApiKey).thenReturn("")
        whenever(aiConfig.maxInputChars).thenReturn(8_000)

        val res = mvc.post("/orders/parse") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"buy 10 AAPL"}"""
        }.andReturn()

        assertEquals(200, res.response.status)
        assertTrue(res.response.contentAsString.contains("\"method\":\"code\""))
        assertTrue(res.response.contentAsString.contains("\"intent\":false"))
        assertTrue(res.response.contentAsString.contains("\"symbol\":\"AAPL\""))
        verify(quotas, never()).consume(any(), any(), any())
        verify(provider, never()).parse(any())
    }

    @Test
    fun decisionPathConsumesQuotaAndReturnsModelParse() {
        auth()
        whenever(aiConfig.provider).thenReturn("decision")
        whenever(aiConfig.decisionApiKey).thenReturn("k")
        whenever(aiConfig.maxInputChars).thenReturn(8_000)
        whenever(provider.parse(any())).thenReturn(ParsedOrder(true, "buy", "AAPL", 10, "model"))

        assertTrue(postParse("buy 10 AAPL").contains("\"method\":\"model\""))
        verify(quotas).consume(any(), any(), any())
    }

    @Test
    fun decisionKeyMissingFallsBackWithoutQuota() {
        auth()
        whenever(aiConfig.provider).thenReturn("decision")
        whenever(aiConfig.decisionApiKey).thenReturn("")
        whenever(aiConfig.maxInputChars).thenReturn(8_000)

        assertTrue(postParse("buy 10 AAPL").contains("\"method\":\"code\""))
        verify(quotas, never()).consume(any(), any(), any())
    }

    @Test
    fun providerFailureFallsBackToCode() {
        auth()
        whenever(aiConfig.provider).thenReturn("decision")
        whenever(aiConfig.decisionApiKey).thenReturn("k")
        whenever(aiConfig.maxInputChars).thenReturn(8_000)
        whenever(provider.parse(any())).thenAnswer { throw stockgame.ai.AiException("down") }

        assertTrue(postParse("buy 10 AAPL").contains("\"method\":\"code\""))
    }

    @Test
    fun blankTextIs400() {
        auth()
        whenever(aiConfig.maxInputChars).thenReturn(8_000)
        val res = mvc.post("/orders/parse") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"  "}"""
        }.andReturn()
        assertEquals(HttpStatus.BAD_REQUEST.value(), res.response.status)
    }

    @Test
    fun overlongTextIs413() {
        auth()
        whenever(aiConfig.maxInputChars).thenReturn(10)
        val res = mvc.post("/orders/parse") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"buy 10 AAPL today please"}"""
        }.andReturn()
        assertEquals(413, res.response.status)
    }

    @Test
    fun missingJwtIs401() {
        val res = mvc.post("/orders/parse") {
            header("X-Api-Version", "1")
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"buy 10 AAPL"}"""
        }.andReturn()
        assertEquals(HttpStatus.UNAUTHORIZED.value(), res.response.status)
    }
}
