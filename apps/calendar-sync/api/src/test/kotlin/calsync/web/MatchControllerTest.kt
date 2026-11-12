package calsync.web

import calsync.ai.AiConfig
import calsync.ai.AiQuotaService
import calsync.match.MatchEvent
import calsync.match.MatchProvider
import calsync.match.MatchSuggestion
import calsync.persist.UserEntity
import calsync.persist.UserRepo
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
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
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@WebMvcTest(MatchController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, IdentityUser::class)
class MatchControllerTest {
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
    lateinit var provider: MatchProvider

    private fun auth() {
        whenever(decoder.decode(any())).thenReturn(
            Jwt.withTokenValue("tok")
                .header("alg", "RS256")
                .claim("sub", "u1")
                .claim("preferred_username", "u1")
                .claim("aud", listOf("calendar-sync"))
                .build(),
        )
        whenever(users.findBySubject("u1")).thenReturn(UserEntity(id = UUID.randomUUID(), subject = "u1"))
    }

    private fun body(): String = BODY

    @Test
    fun disabledProviderReturnsExactWithoutQuota() {
        auth()
        whenever(aiConfig.provider).thenReturn("")
        whenever(aiConfig.decisionApiKey).thenReturn("")
        whenever(provider.suggest(any(), any())).thenReturn(
            listOf(MatchSuggestion("t1", "n1", 1.0, "exact")),
        )

        val res = mvc.post("/match/suggest") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = body()
        }.andReturn()

        assertEquals(200, res.response.status)
        assertTrue(res.response.contentAsString.contains("exact"))
        verify(quotas, never()).consume(any(), eq(30), eq(100))
    }

    @Test
    fun decisionPathConsumesQuotaAndReturnsModelMatches() {
        auth()
        whenever(aiConfig.provider).thenReturn("decision")
        whenever(aiConfig.decisionApiKey).thenReturn("k")
        whenever(aiConfig.maxInputChars).thenReturn(8_000)
        whenever(provider.suggest(any(), any())).thenReturn(
            listOf(MatchSuggestion("t1", "n1", 0.9, "model")),
        )

        val res = mvc.post("/match/suggest") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = body()
        }.andReturn()

        assertEquals(200, res.response.status)
        assertTrue(res.response.contentAsString.contains("model"))
        verify(quotas).consume(any(), any(), any())
    }

    @Test
    fun badBodyIs400() {
        auth()
        val res = mvc.post("/match/suggest") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{"trakt":[],"netflix":[]}"""
        }.andReturn()
        assertEquals(200, res.response.status)

        val missing = mvc.post("/match/suggest") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{"trakt":[{"uid":"","title":"x"}]}"""
        }.andReturn()
        assertEquals(HttpStatus.BAD_REQUEST.value(), missing.response.status)

        val absent = postJson("""{"netflix":[{"uid":"n1","title":"Dune"}]}""")
        assertEquals(HttpStatus.BAD_REQUEST.value(), absent)
    }

    @Test
    fun tooManyEventsIs400() {
        auth()
        val many = (0 until 21).joinToString(",") { """{"uid":"t$it","title":"Show $it"}""" }
        assertEquals(HttpStatus.BAD_REQUEST.value(), postJson("""{"trakt":[$many],"netflix":[]}"""))
    }

    @Test
    fun nullAndBlankFieldsAre400() {
        auth()
        assertEquals(
            HttpStatus.BAD_REQUEST.value(),
            postJson("""{"trakt":[{"title":"Dune"}],"netflix":[{"uid":"n1"}]}"""),
        )
        assertEquals(
            HttpStatus.BAD_REQUEST.value(),
            postJson("""{"trakt":[{"uid":"t1","title":"  "}],"netflix":[]}"""),
        )
    }

    private fun postJson(payload: String): Int = mvc.post("/match/suggest") {
        header("X-Api-Version", "1")
        header("Authorization", "Bearer t")
        contentType = MediaType.APPLICATION_JSON
        content = payload
    }.andReturn().response.status

    @Test
    fun decisionKeyMissingFallsBackWithoutQuota() {
        auth()
        whenever(aiConfig.provider).thenReturn("decision")
        whenever(aiConfig.decisionApiKey).thenReturn("")

        val res = mvc.post("/match/suggest") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = body()
        }.andReturn()

        assertEquals(200, res.response.status)
        assertTrue(res.response.contentAsString.contains("exact"))
        verify(quotas, never()).consume(any(), any(), any())
    }

    @Test
    fun providerFailureFallsBackToExact() {
        auth()
        whenever(aiConfig.provider).thenReturn("decision")
        whenever(aiConfig.decisionApiKey).thenReturn("k")
        whenever(aiConfig.maxInputChars).thenReturn(8_000)
        whenever(provider.suggest(any(), any())).thenThrow(RuntimeException("model down"))

        val res = mvc.post("/match/suggest") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = body()
        }.andReturn()

        assertEquals(200, res.response.status)
        assertTrue(res.response.contentAsString.contains("exact"))
    }

    @Test
    fun overBudgetIs413() {
        auth()
        whenever(aiConfig.provider).thenReturn("decision")
        whenever(aiConfig.decisionApiKey).thenReturn("k")
        whenever(aiConfig.maxInputChars).thenReturn(10)
        val big = "Dune".padEnd(20, 'e')

        assertEquals(
            413,
            postJson("""{"trakt":[{"uid":"t1","title":"$big"}],"netflix":[]}"""),
        )
        verify(quotas, never()).consume(any(), any(), any())
    }

    @Test
    fun disabledPathSkipsBudget() {
        auth()
        whenever(aiConfig.provider).thenReturn("")
        whenever(aiConfig.decisionApiKey).thenReturn("")
        whenever(aiConfig.maxInputChars).thenReturn(10)
        val big = "Dune".padEnd(20, 'e')

        val res = mvc.post("/match/suggest") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{"trakt":[{"uid":"t1","title":"$big"}],"netflix":[]}"""
        }.andReturn()

        assertEquals(200, res.response.status)
    }

    @Test
    fun missingJwtIs401() {
        val res = mvc.post("/match/suggest") {
            header("X-Api-Version", "1")
            contentType = MediaType.APPLICATION_JSON
            content = body()
        }.andReturn()
        assertEquals(HttpStatus.UNAUTHORIZED.value(), res.response.status)
    }
}

private const val BODY: String =
    """{"trakt":[{"uid":"t1","title":"Dune"}],"netflix":[{"uid":"n1","title":"dune"}]}"""
