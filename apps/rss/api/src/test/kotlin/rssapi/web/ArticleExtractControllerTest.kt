package rssapi.web

import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post
import rssapi.ingest.ArticleExtractService
import rssapi.ingest.ExtractResult
import rssapi.persist.ArticleEntity
import rssapi.persist.UserEntity
import rssapi.persist.UserRepo
import java.time.Instant
import java.util.UUID

private fun extractJwt(sub: String): Jwt = Jwt.withTokenValue("tok")
    .header("alg", "RS256")
    .claim("sub", sub)
    .claim("preferred_username", sub)
    .claim("aud", listOf("rss-reader"))
    .build()

@WebMvcTest(ArticleExtractController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, IdentityUser::class)
class ArticleExtractControllerTest {
    @Autowired
    lateinit var mvc: MockMvc

    @MockitoBean
    lateinit var decoder: JwtDecoder

    @MockitoBean
    lateinit var users: UserRepo

    @MockitoBean
    lateinit var extract: ArticleExtractService

    private fun stubAuth() {
        whenever(decoder.decode(any())).thenReturn(extractJwt("u1"))
        whenever(users.findBySubject("u1")).thenReturn(UserEntity(id = UUID.randomUUID(), subject = "u1"))
    }

    @Test
    fun extractReturnsArticle() {
        stubAuth()
        val article = ArticleEntity(
            id = "a1",
            feedId = UUID.randomUUID(),
            guid = "g",
            title = "Batteries",
            link = "https://example.com/a",
            contentHtml = "<p>rich</p>",
            publishedAt = Instant.parse("2026-01-01T00:00:00Z"),
            fetchedAt = Instant.parse("2026-01-01T00:00:00Z"),
        )
        whenever(
            extract.extractForUser(any(), eq("a1")),
        ).thenReturn(ExtractResult(article, true, "https://example.com/a"))
        mvc.post("/articles/a1/extract") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
        }.andExpect {
            status { isOk() }
            jsonPath("$.extracted") { value(true) }
            jsonPath("$.article.id") { value("a1") }
        }
    }
}
