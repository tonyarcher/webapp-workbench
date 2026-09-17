package rssapi.web

import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleRepo
import rssapi.persist.ArticleStateRepo
import rssapi.persist.SubscriptionRepo
import rssapi.persist.UserEntity
import rssapi.persist.UserRepo

private fun stateJwt(sub: String): org.springframework.security.oauth2.jwt.Jwt =
    org.springframework.security.oauth2.jwt.Jwt.withTokenValue("tok")
        .header("alg", "RS256")
        .claim("sub", sub)
        .claim("preferred_username", "alice")
        .claim("aud", listOf("rss-reader"))
        .build()

@WebMvcTest(ArticleWriteController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, IdentityUser::class)
class ArticleStateTest {
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
    lateinit var subs: SubscriptionRepo

    private fun auth(uid: UUID) {
        whenever(decoder.decode(any())).thenReturn(stateJwt("u1"))
        whenever(users.findBySubject("u1")).thenReturn(UserEntity(id = uid, subject = "u1"))
    }

    @Test
    fun missingUpdatesIs400() {
        auth(UUID.randomUUID())
        val res = mvc.post("/articles/state") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{}"""
        }.andReturn()
        assertEquals(400, res.response.status)
    }

    @Test
    fun updateSkipsBareIds() {
        val uid = UUID.randomUUID()
        auth(uid)
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(UUID.randomUUID()))
        val res = mvc.post("/articles/state") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{"updates":[{"id":"a1"}]}"""
        }.andReturn()
        assertEquals(200, res.response.status)
        assertEquals(true, res.response.contentAsString.contains("\"updated\":0"))
    }

    @Test
    fun updateUnreads() {
        val uid = UUID.randomUUID()
        val feedId = UUID.randomUUID()
        auth(uid)
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(feedId))
        whenever(articles.findAllById(listOf("a1"))).thenReturn(
            listOf(ArticleEntity(id = "a1", feedId = feedId)),
        )
        whenever(states.findById(any())).thenReturn(Optional.empty())
        val res = mvc.post("/articles/state") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{"updates":[{"id":"a1","read":false,"starred":false}]}"""
        }.andReturn()
        assertEquals(200, res.response.status)
        assertEquals(true, res.response.contentAsString.contains("\"updated\":1"))
    }

    @Test
    fun invalidFeedIdIs400() {
        auth(UUID.randomUUID())
        val res = mvc.post("/articles/read-before") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{"feedIds":["nope"],"cutoff":1}"""
        }.andReturn()
        assertEquals(400, res.response.status)
    }

    @Test
    fun missingCutoffIs400() {
        auth(UUID.randomUUID())
        val res = mvc.post("/articles/read-before") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{}"""
        }.andReturn()
        assertEquals(400, res.response.status)
    }

    @Test
    fun stateUpdatesOwned() {
        val uid = UUID.randomUUID()
        val feedId = UUID.randomUUID()
        auth(uid)
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(feedId))
        whenever(articles.findAllById(listOf("a1", "a2"))).thenReturn(
            listOf(ArticleEntity(id = "a1", feedId = feedId), ArticleEntity(id = "a2", feedId = UUID.randomUUID())),
        )
        whenever(states.findById(any())).thenReturn(Optional.empty())
        val res = mvc.post("/articles/state") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{"updates":[{"id":"a1","read":true},{"id":"a2","read":true},{"id":null}]}"""
        }.andReturn()
        assertEquals(200, res.response.status)
        assertEquals(true, res.response.contentAsString.contains("\"updated\":1"))
    }

    @Test
    fun starredOnlyUpdate() {
        val uid = UUID.randomUUID()
        val feedId = UUID.randomUUID()
        auth(uid)
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(feedId))
        whenever(articles.findAllById(listOf("a1"))).thenReturn(
            listOf(ArticleEntity(id = "a1", feedId = feedId)),
        )
        whenever(states.findById(any())).thenReturn(Optional.empty())
        val res = mvc.post("/articles/state") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{"updates":[{"id":"a1","starred":true}]}"""
        }.andReturn()
        assertEquals(200, res.response.status)
        assertEquals(true, res.response.contentAsString.contains("\"updated\":1"))
    }

    @Test
    fun emptyUpdates() {
        auth(UUID.randomUUID())
        val res = mvc.post("/articles/state") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{"updates":[]}"""
        }.andReturn()
        assertEquals(200, res.response.status)
        assertEquals(true, res.response.contentAsString.contains("\"updated\":0"))
    }

    @Test
    fun readAllWithoutBody() {
        val uid = UUID.randomUUID()
        auth(uid)
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(UUID.randomUUID()))
        val res = mvc.post("/articles/read-all") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{}"""
        }.andReturn()
        assertEquals(200, res.response.status)
    }

    @Test
    fun readAllInvalidFeed() {
        auth(UUID.randomUUID())
        val res = mvc.post("/articles/read-all") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{"feedId":"nope"}"""
        }.andReturn()
        assertEquals(400, res.response.status)
    }
}
