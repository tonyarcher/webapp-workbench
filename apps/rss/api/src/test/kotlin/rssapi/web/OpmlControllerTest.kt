package rssapi.web

import java.util.UUID
import org.hamcrest.Matchers
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
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

private fun opmlJwt(sub: String): Jwt = Jwt.withTokenValue("tok")
    .header("alg", "RS256")
    .claim("sub", sub)
    .claim("preferred_username", "alice")
    .claim("aud", listOf("rss-reader"))
    .build()

private fun opmlXml(): String = """<opml version="2.0"><body>""" +
    """<outline text="Tech">""" +
    """<outline type="rss" text="A" xmlUrl="https://a.example/rss"/>""" +
    """<outline type="rss" text="Bad" xmlUrl="javascript:alert(1)"/>""" +
    """</outline>""" +
    """<outline type="rss" text="B" xmlUrl="https://b.example/rss"/>""" +
    """</body></opml>"""

@WebMvcTest(OpmlController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, IdentityUser::class, OpmlImportService::class)
class OpmlControllerTest {
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

    private fun stubAuth(uid: UUID) {
        whenever(decoder.decode(any())).thenReturn(opmlJwt("u1"))
        whenever(users.findBySubject("u1")).thenReturn(
            UserEntity(id = uid, label = "identity", subject = "u1", username = "alice"),
        )
    }

    private fun stubRepos(uid: UUID) {
        whenever(folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid)).thenReturn(emptyList())
        whenever(folders.saveAll(any<List<FolderEntity>>())).thenAnswer { inv ->
            inv.getArgument<List<FolderEntity>>(0).onEach { if (it.id == null) it.id = UUID.randomUUID() }
        }
        whenever(feeds.findByXmlUrlIn(any())).thenReturn(emptyList())
        whenever(feeds.saveAll(any<List<FeedEntity>>())).thenAnswer { inv ->
            inv.getArgument<List<FeedEntity>>(0).onEach { if (it.id == null) it.id = UUID.randomUUID() }
        }
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(emptyList())
        whenever(memberships.findByFolderIdIn(any())).thenReturn(emptyList())
    }

    @Test
    fun importPaintsNamesAndSkipsBadUrls() {
        val uid = UUID.randomUUID()
        stubAuth(uid)
        stubRepos(uid)
        val payload = com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(mapOf("xml" to opmlXml()))

        mvc.post("/opml") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = payload
        }.andExpect {
            status { isOk() }
            jsonPath("$.addedFeeds") { value(2) }
            jsonPath("$.addedFolders") { value(1) }
            jsonPath("$.subscribedFeeds") { value(2) }
            jsonPath("$.skippedFeeds") { value(1) }
            jsonPath("$.folders.length()") { value(1) }
            jsonPath("$.feeds.length()") { value(2) }
            jsonPath("$.feeds[?(@.url=='https://a.example/rss')].folderIds.length()") {
                value(Matchers.hasSize<Any>(1))
            }
        }
    }

    @Test
    fun duplicateUrlsDedupeWithoutSkipped() {
        val uid = UUID.randomUUID()
        stubAuth(uid)
        stubRepos(uid)
        val dup = """<opml version="2.0"><body>""" +
            """<outline text="Tech">""" +
            """<outline type="rss" text="A" xmlUrl="https://a.example/rss"/>""" +
            """<outline type="rss" text="A again" xmlUrl="https://a.example/rss"/>""" +
            """</outline></body></opml>"""
        val payload = com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(mapOf("xml" to dup))

        mvc.post("/opml") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = payload
        }.andExpect {
            status { isOk() }
            jsonPath("$.addedFeeds") { value(1) }
            jsonPath("$.subscribedFeeds") { value(1) }
            jsonPath("$.skippedFeeds") { value(0) }
            jsonPath("$.feeds.length()") { value(1) }
        }
    }
}
