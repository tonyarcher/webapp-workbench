package rssapi.web

import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.eq
import org.mockito.kotlin.isNull
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import rssapi.frontpage.FrontPageService
import rssapi.frontpage.ScoredArticle
import rssapi.frontpage.SignalScores
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleScoreEntity
import rssapi.persist.UserEntity
import rssapi.persist.UserRepo

private fun frontJwt(sub: String): Jwt = Jwt.withTokenValue("tok")
    .header("alg", "RS256")
    .claim("sub", sub)
    .claim("preferred_username", sub)
    .claim("aud", listOf("rss-reader"))
    .build()

@WebMvcTest(FrontPageController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, IdentityUser::class)
class FrontPageControllerTest {
    @Autowired
    lateinit var mvc: MockMvc

    @MockitoBean
    lateinit var decoder: JwtDecoder

    @MockitoBean
    lateinit var users: UserRepo

    @MockitoBean
    lateinit var frontPage: FrontPageService

    private fun auth(uid: UUID) {
        whenever(decoder.decode(any())).thenReturn(frontJwt("u1"))
        whenever(users.findBySubject("u1")).thenReturn(UserEntity(id = uid, subject = "u1"))
    }

    private fun scored(id: String, worthy: Double, full: Boolean): ScoredArticle {
        val article = ArticleEntity(id = id, feedId = UUID.randomUUID(), guid = "g-$id", title = "t-$id")
        val row = if (full) {
            ArticleScoreEntity(
                articleId = id,
                worthy = worthy,
                interest = 0.6,
                topic = null,
                popularityOutlook = 0.5,
                readability = 0.7,
                scoredAt = Instant.ofEpochMilli(1_700_000_000_000L),
                model = "signals-v1",
            )
        } else {
            ArticleScoreEntity(articleId = id, worthy = worthy)
        }
        return ScoredArticle(
            article = article,
            state = null,
            scores = SignalScores(worthy, 0.6, 0.5, 0.7),
            scoreRow = row,
        )
    }

    private fun stubRows(vararg rows: ScoredArticle) {
        whenever(frontPage.frontPage(any(), anyOrNull(), any(), any())).thenReturn(rows.toList())
    }

    @Test
    fun frontPageShape200() {
        val uid = UUID.randomUUID()
        auth(uid)
        stubRows(scored("a1", 0.9, full = true), scored("a2", 0.2, full = false))

        mvc.get("/front-page") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andExpect {
            status { isOk() }
            jsonPath("$.generatedAt") { exists() }
            jsonPath("$.articles.length()") { value(2) }
            jsonPath("$.articles[0].id") { value("a1") }
            jsonPath("$.articles[0].scores.worthy") { value(0.9) }
            jsonPath("$.articles[0].scores.interest") { value(0.6) }
            jsonPath("$.articles[0].scores.model") { value("signals-v1") }
            jsonPath("$.articles[0].scores.scoredAt") { value(1_700_000_000_000L) }
            jsonPath("$.articles[1].scores.worthy") { value(0.2) }
        }
    }

    @Test
    fun badSinceIs400() {
        auth(UUID.randomUUID())
        val res = mvc.get("/front-page?since=abc") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andReturn()
        assertEquals(400, res.response.status)
        assertEquals("""{"error":"invalid since"}""", res.response.contentAsString)
    }

    @Test
    fun missingJwtIs401() {
        val res = mvc.get("/front-page") {
            header("X-Api-Version", "1")
        }.andReturn()
        assertEquals(401, res.response.status)
        assertEquals("""{"error":"unauthorized"}""", res.response.contentAsString)
    }

    @Test
    fun forwardsFiltersAndLimit() {
        val uid = UUID.randomUUID()
        auth(uid)
        stubRows()

        mvc.get("/front-page?unreadOnly=1&limit=5&since=1000") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andExpect { status { isOk() } }
        verify(frontPage).frontPage(eq(uid), eq(1_000L), eq(true), eq(5))
    }

    @Test
    fun defaultsWhenNoParams() {
        val uid = UUID.randomUUID()
        auth(uid)
        stubRows()

        mvc.get("/front-page") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andExpect { status { isOk() } }
        verify(frontPage).frontPage(eq(uid), isNull(), eq(false), eq(50))
    }
}
