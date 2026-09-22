package rssapi.web

import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
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
import rssapi.persist.AffinityEntity
import rssapi.persist.AffinityId
import rssapi.persist.AffinityRepo
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleRepo
import rssapi.persist.SubscriptionRepo
import rssapi.persist.UserEntity
import rssapi.persist.UserRepo

private fun affinityJwt(sub: String): Jwt = Jwt.withTokenValue("tok")
    .header("alg", "RS256")
    .claim("sub", sub)
    .claim("preferred_username", sub)
    .claim("aud", listOf("rss-reader"))
    .build()

@WebMvcTest(AffinityController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, IdentityUser::class)
class AffinityControllerTest {
    @Autowired
    lateinit var mvc: MockMvc

    @MockitoBean
    lateinit var decoder: JwtDecoder

    @MockitoBean
    lateinit var users: UserRepo

    @MockitoBean
    lateinit var articles: ArticleRepo

    @MockitoBean
    lateinit var affinity: AffinityRepo

    @MockitoBean
    lateinit var subs: SubscriptionRepo

    private fun asUser(sub: String, id: UUID) {
        whenever(decoder.decode(any())).thenReturn(affinityJwt(sub))
        whenever(users.findBySubject(sub)).thenReturn(UserEntity(id = id, subject = sub))
    }

    @Test
    fun missingFieldsIs400() {
        asUser("u1", UUID.randomUUID())
        val res = mvc.post("/affinity") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{"articleId":null,"amount":null}"""
        }.andReturn()
        assertEquals(400, res.response.status)
    }

    @Test
    fun unknownArticleIs404() {
        asUser("u1", UUID.randomUUID())
        whenever(articles.findById("nope")).thenReturn(Optional.empty())
        val res = mvc.post("/affinity") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{"articleId":"nope","amount":1.0}"""
        }.andReturn()
        assertEquals(404, res.response.status)
    }

    @Test
    fun happyPathBumps() {
        val uid = UUID.randomUUID()
        val feedId = UUID.randomUUID()
        asUser("u1", uid)
        whenever(articles.findById("a1")).thenReturn(
            Optional.of(ArticleEntity(id = "a1", feedId = feedId, author = "Bob", domain = "example.com")),
        )
        whenever(subs.existsByUserIdAndFeedId(uid, feedId)).thenReturn(true)
        whenever(affinity.findById(any())).thenReturn(Optional.empty())
        whenever(affinity.save(any<AffinityEntity>())).thenAnswer { it.getArgument<AffinityEntity>(0) }
        val res = mvc.post("/affinity") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{"articleId":"a1","amount":2.0}"""
        }.andReturn()
        assertEquals(200, res.response.status)
    }

    @Test
    fun unsubscribedIs404() {
        val uid = UUID.randomUUID()
        val feedId = UUID.randomUUID()
        asUser("u1", uid)
        whenever(articles.findById("a1")).thenReturn(Optional.of(ArticleEntity(id = "a1", feedId = feedId)))
        whenever(subs.existsByUserIdAndFeedId(uid, feedId)).thenReturn(false)
        val res = mvc.post("/affinity") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{"articleId":"a1","amount":1.0}"""
        }.andReturn()
        assertEquals(404, res.response.status)
    }
}
