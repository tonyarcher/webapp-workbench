package rssapi.scrape

import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
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
import rssapi.persist.UserEntity
import rssapi.persist.UserRepo
import rssapi.web.IdentityUser
import rssapi.web.RequestIdFilter
import rssapi.web.SecurityConfig
import java.util.UUID

@WebMvcTest(ScrapeController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, IdentityUser::class)
class ScrapeControllerTest {
    @Autowired
    lateinit var mvc: MockMvc

    @MockitoBean
    lateinit var decoder: JwtDecoder

    @MockitoBean
    lateinit var users: UserRepo

    @MockitoBean
    lateinit var service: PageScrapeService

    private fun stubAuth() {
        whenever(decoder.decode(any())).thenReturn(
            Jwt.withTokenValue("tok")
                .header("alg", "RS256")
                .claim("sub", "u1")
                .claim("aud", listOf("rss-reader"))
                .build(),
        )
        whenever(users.findBySubject("u1")).thenReturn(
            UserEntity(id = UUID.randomUUID(), label = "identity", subject = "u1", username = "alice"),
        )
    }

    private fun preview(body: String) = mvc.post("/sources/preview") {
        header("X-Api-Version", "1")
        header("Authorization", "Bearer good")
        contentType = MediaType.APPLICATION_JSON
        content = body
    }

    @Test
    fun missingVersionIsNotRouted() {
        stubAuth()
        mvc.post("/sources/preview") {
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"url":"https://example.com"}"""
        }.andExpect { status { isNotFound() } }
    }

    @Test
    fun missingAuthIsRejected() {
        mvc.post("/sources/preview") {
            header("X-Api-Version", "1")
            contentType = MediaType.APPLICATION_JSON
            content = """{"url":"https://example.com"}"""
        }.andExpect { status { isUnauthorized() } }
    }

    @Test
    fun returnsCandidates() {
        stubAuth()
        whenever(service.preview(anyOrNull(), anyOrNull())).thenReturn(
            ScrapePreviewResult(
                html = "<article>One</article>",
                baseUrl = "https://example.com/blog",
                title = "Blog",
                strategies = listOf(
                    ScrapeStrategy(
                        "semantic-list",
                        "Article list",
                        0.7f,
                        "strategy:semantic-list",
                        listOf(ScrapeCandidate("One", "https://example.com/one")),
                    ),
                ),
            ),
        )
        preview("""{"url":"https://example.com/blog"}""").andExpect {
            status { isOk() }
            jsonPath("$.strategies.length()") { value(1) }
            jsonPath("$.strategies[0].candidates[0].title") { value("One") }
        }
    }

    @Test
    fun passesTheSelectorThrough() {
        stubAuth()
        whenever(service.preview(anyOrNull(), anyOrNull())).thenReturn(
            ScrapePreviewResult("<p>x</p>", "https://example.com/blog", null, emptyList()),
        )
        preview("""{"url":"https://example.com/blog","selector":".stories"}""").andExpect {
            status { isOk() }
        }
    }

    @Test
    fun validationErrorUsesErrorEnvelope() {
        stubAuth()
        whenever(service.preview(anyOrNull(), anyOrNull())).thenThrow(
            rssapi.web.ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "Invalid page URL"),
        )
        preview("""{"url":"javascript:alert(1)"}""").andExpect {
            status { isBadRequest() }
            jsonPath("$.error") { value("Invalid page URL") }
        }
    }
}
