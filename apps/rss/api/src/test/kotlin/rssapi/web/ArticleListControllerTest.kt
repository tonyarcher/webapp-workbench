package rssapi.web

import java.util.UUID
import kotlin.test.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.data.domain.PageImpl
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
        assertEquals(400, res.response.status)
    }

    @Test
    fun invalidSinceIs400() {
        auth(UUID.randomUUID())
        val res = mvc.get("/articles?since=abc") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andReturn()
        assertEquals(400, res.response.status)
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
}
