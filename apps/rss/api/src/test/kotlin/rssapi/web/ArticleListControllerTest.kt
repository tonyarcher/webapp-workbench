package rssapi.web

import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.data.domain.PageImpl
import org.springframework.http.HttpStatus
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleRepo
import rssapi.persist.ArticleStateRepo
import rssapi.persist.UserEntity
import rssapi.persist.UserRepo
import java.util.UUID
import kotlin.test.assertEquals

private fun listJwt(sub: String): Jwt = Jwt.withTokenValue("tok")
    .header("alg", "RS256")
    .claim("sub", sub)
    .claim("preferred_username", sub)
    .claim("aud", listOf("rss-reader"))
    .build()

@WebMvcTest(ArticleListController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, IdentityUser::class)
class ArticleListControllerTest {
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

    private fun auth(uid: UUID) {
        whenever(decoder.decode(any())).thenReturn(listJwt("u1"))
        whenever(users.findBySubject("u1")).thenReturn(UserEntity(id = uid, subject = "u1"))
    }

    private fun stubEmpty() {
        whenever(
            articles.findAll(
                any<org.springframework.data.jpa.domain.Specification<ArticleEntity>>(),
                any<org.springframework.data.domain.Pageable>(),
            ),
        ).thenReturn(PageImpl(emptyList()))
        whenever(
            states.findByUserIdAndArticleIdIn(
                any<UUID>(),
                any<List<String>>(),
            ),
        ).thenReturn(emptyList())
    }

    @Test
    fun listOkDefaults() {
        val uid = UUID.randomUUID()
        auth(uid)
        stubEmpty()
        val res = mvc.get("/articles") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andReturn()
        assertEquals(200, res.response.status)
    }

    @Test
    fun invalidScopeIs400() {
        auth(UUID.randomUUID())
        val res = mvc.get("/articles?scope=nope") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andReturn()
        assertEquals(HttpStatus.BAD_REQUEST.value(), res.response.status)
    }

    @Test
    fun invalidSinceIs400() {
        auth(UUID.randomUUID())
        val res = mvc.get("/articles?since=abc") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andReturn()
        assertEquals(HttpStatus.BAD_REQUEST.value(), res.response.status)
    }

    @Test
    fun sortsAndUnread() {
        val uid = UUID.randomUUID()
        auth(uid)
        stubEmpty()
        for (sort in listOf("oldest", "hot", "newest")) {
            val res = mvc.get("/articles?sort=$sort&unreadOnly=1&limit=5&since=1000") {
                header("X-Api-Version", "1")
                header("Authorization", "Bearer t")
            }.andReturn()
            assertEquals(200, res.response.status)
        }
    }

    @Test
    fun searchQueryFiltersAndReturnsPage() {
        val uid = UUID.randomUUID()
        auth(uid)
        val entity = ArticleEntity(
            id = "a1",
            feedId = UUID.randomUUID(),
            guid = "g1",
            title = "Battery storage grid",
            summary = "grid batteries",
            publishedAt = java.time.Instant.ofEpochMilli(1000),
            fetchedAt = java.time.Instant.ofEpochMilli(1000),
        )
        whenever(
            articles.findAll(
                any<org.springframework.data.jpa.domain.Specification<ArticleEntity>>(),
                any<org.springframework.data.domain.Pageable>(),
            ),
        ).thenReturn(PageImpl(listOf(entity)))
        whenever(states.findByUserIdAndArticleIdIn(any<UUID>(), any<List<String>>())).thenReturn(emptyList())

        val res = mvc.get("/articles?q=battery+grid&scope=all") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andReturn()
        assertEquals(200, res.response.status)
        val body = res.response.contentAsString
        kotlin.test.assertTrue(body.contains("\"items\""))
        kotlin.test.assertTrue(body.contains("Battery storage grid"))
    }

    @Test
    fun searchQueryWithNoUsableTokensReturnsEmpty() {
        auth(UUID.randomUUID())
        val res = mvc.get("/articles?q=a") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andReturn()
        assertEquals(200, res.response.status)
        val body = res.response.contentAsString
        kotlin.test.assertTrue(body.contains("\"items\":[]"))
    }

    @Test
    fun searchOperatorsAreAccepted() {
        val uid = UUID.randomUUID()
        auth(uid)
        val entity = ArticleEntity(
            id = "a2",
            feedId = UUID.randomUUID(),
            guid = "g2",
            title = "Operator match",
            author = "Ada",
            summary = "video grid",
            publishedAt = java.time.Instant.ofEpochMilli(1_735_689_600_000),
            fetchedAt = java.time.Instant.ofEpochMilli(1_735_689_600_000),
        )
        whenever(
            articles.findAll(
                any<org.springframework.data.jpa.domain.Specification<ArticleEntity>>(),
                any<org.springframework.data.domain.Pageable>(),
            ),
        ).thenReturn(PageImpl(listOf(entity)))
        whenever(states.findByUserIdAndArticleIdIn(any<UUID>(), any<List<String>>())).thenReturn(emptyList())

        val queries = listOf(
            "author:ada",
            "is:starred",
            "is:unread",
            "is:read",
            "after:2025-01-01",
            "before:2025-12-31",
            "has:video",
            "min:readtime:5",
            "feed:grid",
            "folder:tech",
            "author:ada is:unread after:2025-01-01",
        )
        for (q in queries) {
            val res = mvc.get("/articles") {
                param("q", q)
                header("X-Api-Version", "1")
                header("Authorization", "Bearer t")
            }.andReturn()
            assertEquals(200, res.response.status, "failed for q=$q")
            kotlin.test.assertTrue(res.response.contentAsString.contains("\"items\""), "missing items for q=$q")
        }
    }
}
