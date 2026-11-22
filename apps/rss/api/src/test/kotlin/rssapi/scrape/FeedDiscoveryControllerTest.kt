package rssapi.scrape
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
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
import rssapi.feeds.UserEntity
import rssapi.feeds.UserRepo
import rssapi.platform.IdentityUser
import rssapi.platform.RequestIdFilter
import rssapi.platform.SecurityConfig
import java.util.UUID

@WebMvcTest(FeedDiscoveryController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, IdentityUser::class)
class FeedDiscoveryControllerTest {
    @Autowired
    lateinit var mvc: MockMvc

    @MockitoBean
    lateinit var decoder: JwtDecoder

    @MockitoBean
    lateinit var users: UserRepo

    @MockitoBean
    lateinit var service: FeedDiscoveryService

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

    private fun discover(body: String) = mvc.post("/sources/discover") {
        header("X-Api-Version", "1")
        header("Authorization", "Bearer good")
        contentType = MediaType.APPLICATION_JSON
        content = body
    }

    @Test
    fun returnsDiscoveredFeeds() {
        stubAuth()
        whenever(service.discover(any())).thenReturn(
            DiscoveryResult(
                "https://example.com/",
                "Site",
                listOf(
                    DiscoveredFeed("https://example.com/feed.xml", "Main", "rss", "advertised", 0.9f, listOf("One")),
                ),
            ),
        )
        discover("""{"url":"https://example.com/"}""").andExpect {
            status { isOk() }
            jsonPath("$.feeds.length()") { value(1) }
            jsonPath("$.feeds[0].recentTitles[0]") { value("One") }
        }
    }

    @Test
    fun validatesVersionAndAuth() {
        mvc.post("/sources/discover") {
            header("X-Api-Version", "1")
            contentType = MediaType.APPLICATION_JSON
            content = """{"url":"https://example.com/"}"""
        }.andExpect { status { isUnauthorized() } }
        stubAuth()
        mvc.post("/sources/discover") {
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"url":"https://example.com/"}"""
        }.andExpect { status { isNotFound() } }
    }
}
