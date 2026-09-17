package rssapi.web

import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import rssapi.ingest.IngestSync
import rssapi.persist.FeedEntity
import rssapi.persist.FeedRepo
import rssapi.persist.FolderEntity
import rssapi.persist.FolderFeedRepo
import rssapi.persist.FolderRepo
import rssapi.persist.SubscriptionRepo
import rssapi.persist.UserEntity
import rssapi.persist.UserRepo

private fun exportJwt(sub: String): Jwt = Jwt.withTokenValue("tok")
    .header("alg", "RS256")
    .claim("sub", sub)
    .claim("preferred_username", "alice")
    .claim("aud", listOf("rss-reader"))
    .build()

@WebMvcTest(OpmlController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, IdentityUser::class, OpmlImportService::class)
class OpmlExportTest {
    @Autowired
    lateinit var mvc: MockMvc

    @MockitoBean
    lateinit var decoder: JwtDecoder

    @MockitoBean
    lateinit var users: UserRepo

    @MockitoBean
    lateinit var folders: FolderRepo

    @MockitoBean
    lateinit var feeds: FeedRepo

    @MockitoBean
    lateinit var memberships: FolderFeedRepo

    @MockitoBean
    lateinit var sync: IngestSync

    @MockitoBean
    lateinit var subs: SubscriptionRepo

    @MockitoBean
    lateinit var membershipService: MembershipService

    @Test
    fun exportGroupsByFolder() {
        stubExportRows()
        val res = mvc.get("/opml") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andReturn()
        assertEquals(200, res.response.status)
        assertTrue(res.response.contentAsString.contains("<opml"))
        assertTrue(res.response.contentAsString.contains("Tech"))
    }

    private fun stubExportRows(): Triple<UUID, UUID, UUID> {
        val uid = UUID.randomUUID()
        val feedId = UUID.randomUUID()
        val folderId = UUID.randomUUID()
        whenever(decoder.decode(any())).thenReturn(exportJwt("u1"))
        whenever(users.findBySubject("u1")).thenReturn(UserEntity(id = uid, subject = "u1"))
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(feedId))
        whenever(feeds.findAllById(listOf(feedId))).thenReturn(
            listOf(FeedEntity(id = feedId, xmlUrl = "https://a.example/rss", title = "A")),
        )
        whenever(folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid)).thenReturn(
            listOf(FolderEntity(id = folderId, userId = uid, title = "Tech")),
        )
        whenever(membershipService.ownedFolderIds(uid, feedId)).thenReturn(listOf(folderId.toString()))
        whenever(memberships.findByFolderId(folderId)).thenReturn(
            listOf(rssapi.persist.FolderFeedEntity(folderId = folderId, feedId = feedId)),
        )
        whenever(feeds.findById(feedId)).thenReturn(
            java.util.Optional.of(FeedEntity(id = feedId, xmlUrl = "https://a.example/rss", title = "A")),
        )
        return Triple(uid, feedId, folderId)
    }

    @Test
    fun exportMissingXmlIs400() {
        val uid = UUID.randomUUID()
        whenever(decoder.decode(any())).thenReturn(exportJwt("u1"))
        whenever(users.findBySubject("u1")).thenReturn(UserEntity(id = uid, subject = "u1"))
        val res = mvc.post("/opml") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = org.springframework.http.MediaType.APPLICATION_JSON
            content = """{}"""
        }.andReturn()
        assertEquals(400, res.response.status)
    }
}
