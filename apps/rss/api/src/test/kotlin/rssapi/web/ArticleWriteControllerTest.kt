package rssapi.web

import java.util.UUID
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
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
import rssapi.persist.ArticleRepo
import rssapi.persist.ArticleStateRepo
import rssapi.persist.SubscriptionRepo
import rssapi.persist.UserEntity
import rssapi.persist.UserRepo

private fun writeJwt(sub: String): Jwt = Jwt.withTokenValue("tok")
    .header("alg", "RS256")
    .claim("sub", sub)
    .claim("preferred_username", "alice")
    .claim("aud", listOf("rss-reader"))
    .build()

@WebMvcTest(ArticleWriteController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, IdentityUser::class)
class ArticleWriteControllerTest {
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

    private fun stubAuth(uid: UUID) {
        whenever(decoder.decode(any())).thenReturn(writeJwt("u1"))
        whenever(users.findBySubject("u1")).thenReturn(
            UserEntity(id = uid, label = "identity", subject = "u1", username = "alice"),
        )
    }

    @Test
    fun readBeforeMarksInBulk() {
        val uid = UUID.randomUUID()
        val feedA = UUID.randomUUID()
        val feedB = UUID.randomUUID()
        stubAuth(uid)
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(feedA, feedB))

        mvc.post("/articles/read-before") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"feedIds":["$feedA"],"cutoff":1720000000000}"""
        }.andExpect {
            status { isOk() }
        }
        verify(states).markReadBefore(
            org.mockito.kotlin.eq(uid),
            org.mockito.kotlin.eq(listOf(feedA)),
            org.mockito.kotlin.eq(java.time.Instant.ofEpochMilli(1720000000000)),
        )
        verify(states, never()).markReadAll(any(), any())
        verify(articles, never()).findByFeedIdIn(any())
    }

    @Test
    fun readBeforeWithoutFeedsMarksAll() {
        val uid = UUID.randomUUID()
        val feedA = UUID.randomUUID()
        stubAuth(uid)
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(feedA))

        mvc.post("/articles/read-before") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"cutoff":1720000000000}"""
        }.andExpect {
            status { isOk() }
        }
        verify(states).markReadBefore(
            org.mockito.kotlin.eq(uid),
            org.mockito.kotlin.eq(listOf(feedA)),
            org.mockito.kotlin.eq(java.time.Instant.ofEpochMilli(1720000000000)),
        )
    }

    @Test
    fun readAllMarksInBulk() {
        val uid = UUID.randomUUID()
        val owned = UUID.randomUUID()
        stubAuth(uid)
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(owned))

        mvc.post("/articles/read-all") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"feedId":"$owned"}"""
        }.andExpect {
            status { isOk() }
        }
        verify(states).markReadAll(org.mockito.kotlin.eq(uid), org.mockito.kotlin.eq(listOf(owned)))
        verify(states, never()).markReadBefore(any(), any(), any())
    }

    @Test
    fun readAllOutsideSubscriptionsMarksNothing() {
        val uid = UUID.randomUUID()
        val owned = UUID.randomUUID()
        val stranger = UUID.randomUUID()
        stubAuth(uid)
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(owned))

        mvc.post("/articles/read-all") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"feedId":"$stranger"}"""
        }.andExpect {
            status { isOk() }
        }
        verify(states, never()).markReadBefore(any(), any(), any())
        verify(states, never()).markReadAll(any(), any())
        verify(articles, never()).findByFeedIdIn(any())
    }
}
