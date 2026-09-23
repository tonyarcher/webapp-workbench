package rssapi.web

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
import rssapi.ingest.IngestSync
import rssapi.persist.SubscriptionRepo
import rssapi.persist.UserEntity
import rssapi.persist.UserRepo
import rssapi.poller.FeedPoller
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

private fun syncJwt(sub: String): Jwt = Jwt.withTokenValue("tok")
    .header("alg", "RS256")
    .claim("sub", sub)
    .claim("preferred_username", sub)
    .claim("aud", listOf("rss-reader"))
    .build()

@WebMvcTest(SyncController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, IdentityUser::class)
class SyncControllerTest {
    @Autowired
    lateinit var mvc: MockMvc

    @MockitoBean
    lateinit var decoder: JwtDecoder

    @MockitoBean
    lateinit var users: UserRepo

    @MockitoBean
    lateinit var subs: SubscriptionRepo

    @MockitoBean
    lateinit var sync: IngestSync

    @MockitoBean
    lateinit var poller: FeedPoller

    private fun asUser(sub: String, id: UUID, feeds: List<UUID>) {
        whenever(decoder.decode(any())).thenReturn(syncJwt(sub))
        whenever(users.findBySubject(sub)).thenReturn(UserEntity(id = id, subject = sub))
        whenever(subs.findFeedIdsByUserId(id)).thenReturn(feeds)
    }

    @Test
    fun syncAllQueues() {
        val uid = UUID.randomUUID()
        val f1 = UUID.randomUUID()
        asUser("u1", uid, listOf(f1))
        val res = mvc.post("/sync") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{"scope":"all"}"""
        }.andReturn()
        assertEquals(200, res.response.status)
        assertTrue(res.response.contentAsString.contains("\"queued\":1"))
    }

    @Test
    fun syncFiltersToOwned() {
        val uid = UUID.randomUUID()
        val owned = UUID.randomUUID()
        asUser("u1", uid, listOf(owned))
        val res = mvc.post("/sync") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{"scope":{"feedIds":["$owned","${UUID.randomUUID()}"]}}"""
        }.andReturn()
        assertEquals(200, res.response.status)
        assertTrue(res.response.contentAsString.contains("\"queued\":1"))
    }

    @Test
    fun syncWithoutBodySyncsAll() {
        val uid = UUID.randomUUID()
        asUser("u1", uid, listOf(UUID.randomUUID(), UUID.randomUUID()))
        val res = mvc.post("/sync") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andReturn()
        assertEquals(200, res.response.status)
        assertTrue(res.response.contentAsString.contains("\"queued\":2"))
    }

    @Test
    fun syncStringScopeYieldsNothing() {
        val uid = UUID.randomUUID()
        asUser("u1", uid, listOf(UUID.randomUUID()))
        val res = mvc.post("/sync") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{"scope":"some-feed"}"""
        }.andReturn()
        assertEquals(200, res.response.status)
        assertTrue(res.response.contentAsString.contains("\"queued\":0"))
    }

    @Test
    fun syncMapWithoutFeedIdsYieldsNothing() {
        val uid = UUID.randomUUID()
        asUser("u1", uid, listOf(UUID.randomUUID()))
        val res = mvc.post("/sync") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{"scope":{"other":[]}}"""
        }.andReturn()
        assertEquals(200, res.response.status)
        assertTrue(res.response.contentAsString.contains("\"queued\":0"))
    }

    @Test
    fun syncJunkIdsFiltered() {
        val uid = UUID.randomUUID()
        val owned = UUID.randomUUID()
        asUser("u1", uid, listOf(owned))
        val res = mvc.post("/sync") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{"scope":{"feedIds":["not-a-uuid",42,"$owned"]}}"""
        }.andReturn()
        assertEquals(200, res.response.status)
        assertTrue(res.response.contentAsString.contains("\"queued\":1"))
    }
}
