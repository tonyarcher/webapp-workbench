package timesupapi.feeds
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.HttpStatus
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import timesupapi.ingest.IngestSync
import timesupapi.platform.IdentityUser
import timesupapi.platform.RequestIdFilter
import timesupapi.platform.SecurityConfig
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

private fun exportJwt(sub: String): Jwt = Jwt.withTokenValue("tok")
    .header("alg", "RS256")
    .claim("sub", sub)
    .claim("preferred_username", "alice")
    .claim("aud", listOf("times-up"))
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

    @Test
    fun exportGroupsByFolder() {
        val (_, _, folderId) = stubExportRows()
        val res = mvc.get("/opml") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andReturn()
        assertEquals(200, res.response.status)
        assertTrue(res.response.contentAsString.contains("<opml"))
        assertTrue(res.response.contentAsString.contains("<title>Times Up Export</title>"))
        assertTrue(res.response.contentAsString.contains("Tech"))
        verify(memberships).findByFolderIdIn(listOf(folderId))
        verify(feeds, org.mockito.kotlin.never()).findById(any<UUID>())
    }

    @Test
    fun exportIncludesFolderFeedOutsideSubscriptions() {
        val (_, feedId, folderId) = stubExportRows()
        val extraId = UUID.randomUUID()
        val rows = listOf(
            timesupapi.feeds.FolderFeedEntity(folderId = folderId, feedId = feedId),
            timesupapi.feeds.FolderFeedEntity(folderId = folderId, feedId = extraId),
        )
        whenever(memberships.findByFolderIdIn(listOf(folderId))).thenReturn(rows)
        val extra =
            FeedEntity(
                id = extraId,
                xmlUrl = "https://extra.example/rss",
                title = "Extra",
                siteUrl = "https://extra.example",
            )
        whenever(feeds.findAllById(listOf(extraId))).thenReturn(listOf(extra))
        val res = mvc.get("/opml") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andReturn()
        assertEquals(200, res.response.status)
        assertTrue(res.response.contentAsString.contains("Extra"))
    }

    @Test
    fun exportSkipsMissingFolderFeed() {
        val (_, _, folderId) = stubExportRows()
        whenever(memberships.findByFolderIdIn(listOf(folderId))).thenReturn(
            listOf(timesupapi.feeds.FolderFeedEntity(folderId = folderId, feedId = UUID.randomUUID())),
        )
        whenever(feeds.findAllById(any())).thenReturn(emptyList())
        mvc.get("/opml") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andExpect { status { isOk() } }
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
        whenever(memberships.findByFolderIdIn(listOf(folderId))).thenReturn(
            listOf(timesupapi.feeds.FolderFeedEntity(folderId = folderId, feedId = feedId)),
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
        assertEquals(HttpStatus.BAD_REQUEST.value(), res.response.status)
    }
}
