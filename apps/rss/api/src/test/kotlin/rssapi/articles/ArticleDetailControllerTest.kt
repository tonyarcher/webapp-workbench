package rssapi.articles

import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import rssapi.feeds.SubscriptionRepo
import rssapi.feeds.UserEntity
import rssapi.feeds.UserRepo
import rssapi.platform.IdentityUser
import rssapi.platform.RequestIdFilter
import rssapi.platform.SecurityConfig
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@WebMvcTest(ArticleDetailController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, IdentityUser::class)
class ArticleDetailControllerTest {
    @Autowired
    lateinit var mvc: MockMvc

    @MockitoBean
    lateinit var decoder: JwtDecoder

    @MockitoBean
    lateinit var users: UserRepo

    @MockitoBean
    lateinit var articles: ArticleRepo

    @MockitoBean
    lateinit var states: ArticleStateRepo

    @MockitoBean
    lateinit var scores: ArticleScoreRepo

    @MockitoBean
    lateinit var subscriptions: SubscriptionRepo

    private fun auth(uid: UUID) {
        val jwt = Jwt.withTokenValue("tok")
            .header("alg", "RS256")
            .claim("sub", "u1")
            .claim("aud", listOf("rss-reader"))
            .build()
        whenever(decoder.decode(any())).thenReturn(jwt)
        whenever(users.findBySubject("u1")).thenReturn(UserEntity(id = uid, subject = "u1"))
    }

    @Test
    fun returnsOwnedArticleWithoutBody() {
        val uid = UUID.randomUUID()
        val feedId = UUID.randomUUID()
        auth(uid)
        whenever(subscriptions.findFeedIdsByUserId(uid)).thenReturn(listOf(feedId))
        whenever(articles.findById("a1")).thenReturn(
            Optional.of(ArticleEntity(id = "a1", feedId = feedId, guid = "g1", title = "Deep link")),
        )
        whenever(states.findByUserIdAndArticleIdIn(uid, listOf("a1"))).thenReturn(emptyList())
        whenever(scores.findById("a1")).thenReturn(Optional.empty())

        val res = mvc.get("/articles/a1") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andReturn()

        assertEquals(200, res.response.status)
        assertTrue(res.response.contentAsString.contains("\"title\":\"Deep link\""))
        assertTrue(!res.response.contentAsString.contains("\"content\""))
    }

    @Test
    fun unownedArticleIsNotFound() {
        val uid = UUID.randomUUID()
        auth(uid)
        whenever(subscriptions.findFeedIdsByUserId(uid)).thenReturn(emptyList())
        whenever(articles.findById("a1")).thenReturn(
            Optional.of(ArticleEntity(id = "a1", feedId = UUID.randomUUID(), guid = "g1", title = "Private")),
        )

        val res = mvc.get("/articles/a1") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andReturn()

        assertEquals(404, res.response.status)
    }

    @Test
    fun missingVersionIsNotFound() {
        auth(UUID.randomUUID())
        val res = mvc.get("/articles/a1") {
            header("Authorization", "Bearer t")
        }.andReturn()
        assertEquals(404, res.response.status)
    }

    @Test
    fun missingTokenIsUnauthorized() {
        val res = mvc.get("/articles/a1") {
            header("X-Api-Version", "1")
        }.andReturn()
        assertEquals(401, res.response.status)
    }
}
