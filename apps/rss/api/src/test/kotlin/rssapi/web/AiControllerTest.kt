package rssapi.web

import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.eq
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
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import rssapi.ai.AiHighlightService
import rssapi.ai.AiService
import rssapi.ai.AiStatus
import rssapi.ai.HighlightExcerpt
import rssapi.ai.HighlightResult
import rssapi.ai.SummaryLength
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleRepo
import rssapi.persist.SubscriptionRepo
import rssapi.persist.UserEntity
import rssapi.persist.UserRepo
import java.util.Optional
import java.util.UUID

private fun aiJwt(sub: String): Jwt = Jwt.withTokenValue("tok")
    .header("alg", "RS256")
    .claim("sub", sub)
    .claim("preferred_username", "alice")
    .claim("aud", listOf("rss-reader"))
    .build()

@WebMvcTest(AiController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, IdentityUser::class)
class AiControllerTest {
    @Autowired
    lateinit var mvc: MockMvc

    @MockitoBean
    lateinit var decoder: JwtDecoder

    @MockitoBean
    lateinit var users: UserRepo

    @MockitoBean
    lateinit var ai: AiService

    @MockitoBean
    lateinit var articles: ArticleRepo

    @MockitoBean
    lateinit var subs: SubscriptionRepo

    @MockitoBean
    lateinit var highlights: AiHighlightService

    private fun stubAuth() {
        whenever(decoder.decode(any())).thenReturn(aiJwt("u1"))
        whenever(users.findBySubject("u1")).thenReturn(
            UserEntity(id = UUID.randomUUID(), label = "identity", subject = "u1", username = "alice"),
        )
    }

    @Test
    fun statusReportsAvailability() {
        stubAuth()
        whenever(ai.status()).thenReturn(AiStatus("ollama", "qwen3:8b", true))

        mvc.get("/ai/status") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
        }.andExpect {
            status { isOk() }
            jsonPath("$.available") { value(true) }
            jsonPath("$.provider") { value("ollama") }
        }
    }

    @Test
    fun summarizeReturnsText() {
        stubAuth()
        whenever(ai.summarize(any(), anyOrNull(), any(), any())).thenReturn("- a\n- b")

        mvc.post("/ai/summarize") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"title":"T","text":"body"}"""
        }.andExpect {
            status { isOk() }
            jsonPath("$.summary") { value("- a\n- b") }
        }
    }

    @Test
    fun summarizeForwardsLength() {
        stubAuth()
        whenever(ai.summarize(any(), anyOrNull(), any(), any())).thenReturn("- a")

        mvc.post("/ai/summarize") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"body","length":"brief"}"""
        }.andExpect {
            status { isOk() }
        }
        verify(ai).summarize(any(), anyOrNull(), eq("body"), eq(SummaryLength.BRIEF))
    }

    @Test
    fun invalidLengthIs400() {
        stubAuth()

        mvc.post("/ai/summarize") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"body","length":"huge"}"""
        }.andExpect {
            status { isBadRequest() }
        }
    }

    @Test
    fun quotaErrorSurfaces429() {
        stubAuth()
        whenever(
            ai.summarize(any(), anyOrNull(), any(), any()),
        ).thenThrow(ApiException(HttpStatus.TOO_MANY_REQUESTS, "hourly AI budget used"))

        mvc.post("/ai/summarize") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"body"}"""
        }.andExpect {
            status { isTooManyRequests() }
        }
    }

    @Test
    fun highlightsReturnsSelectedExcerpts() {
        stubAuth()
        val feed = UUID.randomUUID()
        whenever(articles.findById("a1")).thenReturn(
            Optional.of(ArticleEntity(id = "a1", feedId = feed, guid = "g", title = "Batteries")),
        )
        whenever(subs.findFeedIdsByUserId(any<UUID>())).thenReturn(listOf(feed))
        whenever(highlights.highlights(any<UUID>(), eq("Batteries"), anyOrNull(), any<Int>())).thenReturn(
            HighlightResult(true, listOf(HighlightExcerpt(0, "Battery costs fell again.", 0.8)), 0.7, 0.1),
        )

        mvc.get("/ai/highlights/a1") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
        }.andExpect {
            status { isOk() }
            jsonPath("$.available") { value(true) }
            jsonPath("$.excerpts[0].text") { value("Battery costs fell again.") }
            jsonPath("$.interesting") { value(0.7) }
        }
    }

    @Test
    fun highlightsUnknownArticleIs404() {
        stubAuth()
        whenever(articles.findById("missing")).thenReturn(Optional.empty())
        mvc.get("/ai/highlights/missing") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
        }.andExpect { status { isNotFound() } }
    }

    @Test
    fun highlightsUnsubscribedFeedIs404() {
        stubAuth()
        whenever(articles.findById("a1")).thenReturn(
            Optional.of(ArticleEntity(id = "a1", feedId = UUID.randomUUID(), guid = "g", title = "T")),
        )
        whenever(subs.findFeedIdsByUserId(any<UUID>())).thenReturn(listOf(UUID.randomUUID()))
        mvc.get("/ai/highlights/a1") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
        }.andExpect { status { isNotFound() } }
    }

    @Test
    fun missingTextIs400() {
        stubAuth()

        mvc.post("/ai/summarize") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{}"""
        }.andExpect {
            status { isBadRequest() }
        }
    }
}
