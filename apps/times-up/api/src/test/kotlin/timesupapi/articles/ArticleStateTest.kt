package timesupapi.articles
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post
import timesupapi.feeds.SubscriptionRepo
import timesupapi.feeds.UserEntity
import timesupapi.feeds.UserRepo
import timesupapi.platform.IdentityUser
import timesupapi.platform.RequestIdFilter
import timesupapi.platform.SecurityConfig
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals

private fun stateJwt(sub: String): org.springframework.security.oauth2.jwt.Jwt =
    org.springframework.security.oauth2.jwt.Jwt.withTokenValue("tok")
        .header("alg", "RS256")
        .claim("sub", sub)
        .claim("preferred_username", "alice")
        .claim("aud", listOf("times-up"))
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

    private fun feedRow(articleId: String, feedId: UUID): ArticleRepo.ArticleFeedRow =
        object : ArticleRepo.ArticleFeedRow {
            override val id = articleId
            override val feedId = feedId
        }

    @Test
    fun rejectsTooManyUpdates() {
        auth(UUID.randomUUID())
        val updates = (1..MAX_STATE_UPDATES + 1).joinToString(",") { """{"id":"a$it","read":true}""" }
        val res = mvc.post("/articles/state") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{"updates":[$updates]}"""
        }.andReturn()
        assertEquals(HttpStatus.BAD_REQUEST.value(), res.response.status)
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
        assertEquals(HttpStatus.BAD_REQUEST.value(), res.response.status)
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
        whenever(articles.findFeedIdsByIdIn(any())).thenReturn(
            listOf(feedRow("a1", feedId)),
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
        assertEquals(HttpStatus.BAD_REQUEST.value(), res.response.status)
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
        assertEquals(HttpStatus.BAD_REQUEST.value(), res.response.status)
    }

    @Test
    fun stateUpdatesOwned() {
        val uid = UUID.randomUUID()
        val feedId = UUID.randomUUID()
        auth(uid)
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(feedId))
        whenever(articles.findFeedIdsByIdIn(any())).thenReturn(
            listOf(feedRow("a1", feedId), feedRow("a2", UUID.randomUUID())),
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
        whenever(articles.findFeedIdsByIdIn(any())).thenReturn(
            listOf(feedRow("a1", feedId)),
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
        assertEquals(HttpStatus.BAD_REQUEST.value(), res.response.status)
    }
}
