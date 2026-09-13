package rssapi.web

import java.time.Instant
import java.util.UUID
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import rssapi.persist.ArticleRepo
import rssapi.persist.FeedEntity
import rssapi.persist.FeedRepo
import rssapi.persist.FeedSyncEntity
import rssapi.persist.FeedSyncRepo
import rssapi.persist.FolderEntity
import rssapi.persist.FolderFeedEntity
import rssapi.persist.FolderFeedRepo
import rssapi.persist.FolderRepo
import rssapi.persist.SubscriptionRepo
import rssapi.persist.UserEntity
import rssapi.persist.UserRepo

private fun libJwt(sub: String): Jwt = Jwt.withTokenValue("tok")
    .header("alg", "RS256")
    .claim("sub", sub)
    .claim("preferred_username", "alice")
    .claim("aud", listOf("rss-reader"))
    .build()

@WebMvcTest(LibraryController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, IdentityUser::class)
class LibraryControllerTest {
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
    lateinit var sync: FeedSyncRepo

    @MockitoBean
    lateinit var articles: ArticleRepo

    @MockitoBean
    lateinit var subs: SubscriptionRepo

    private fun stubAuth(uid: UUID) {
        whenever(decoder.decode(any())).thenReturn(libJwt("u1"))
        whenever(users.findBySubject("u1")).thenReturn(
            UserEntity(id = uid, label = "identity", subject = "u1", username = "alice"),
        )
    }

    private data class LibraryRows(
        val uid: UUID,
        val folderId: UUID,
        val feedA: UUID,
        val feedB: UUID,
    )

    private fun stubLibrary(): LibraryRows {
        val uid = UUID.randomUUID()
        val folderId = UUID.randomUUID()
        val feedA = UUID.randomUUID()
        val feedB = UUID.randomUUID()
        stubAuth(uid)
        whenever(folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid)).thenReturn(
            listOf(FolderEntity(id = folderId, userId = uid, title = "Tech")),
        )
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(feedA, feedB))
        whenever(feeds.findAllById(listOf(feedA, feedB))).thenReturn(
            listOf(
                FeedEntity(id = feedA, xmlUrl = "https://a.example/rss", title = "A"),
                FeedEntity(id = feedB, xmlUrl = "https://b.example/rss", title = "B"),
            ),
        )
        whenever(memberships.findByFeedIdIn(listOf(feedA, feedB))).thenReturn(
            listOf(FolderFeedEntity(folderId = folderId, feedId = feedA)),
        )
        whenever(sync.findAllById(listOf(feedA, feedB))).thenReturn(
            listOf(FeedSyncEntity(feedId = feedA, lastFetchedAt = Instant.parse("2026-09-01T00:00:00Z"))),
        )
        whenever(articles.countUnreadByFeed(uid, listOf(feedA, feedB))).thenReturn(
            listOf(object : ArticleRepo.UnreadCount {
                override val feedId = feedA
                override val cnt = 7L
            }),
        )
        return LibraryRows(uid, folderId, feedA, feedB)
    }

    @Test
    fun libraryPaintsNamesWithoutTouchingArticles() {
        val rows = stubLibrary()

        mvc.get("/library") {
            header("Authorization", "Bearer good")
        }.andExpect {
            status { isOk() }
            jsonPath("$.folders.length()") { value(1) }
            jsonPath("$.feeds.length()") { value(2) }
            jsonPath("$.feeds[?(@.url=='https://a.example/rss')].folderIds[0]") {
                value(rows.folderId.toString())
            }
            jsonPath("$.feeds[?(@.url=='https://a.example/rss')].unread") { value(0) }
            jsonPath("$.feeds[?(@.url=='https://a.example/rss')].lastFetchedAt") { exists() }
        }
        verify(articles, never()).countUnread(any(), any())
        verify(articles, never()).countUnreadByFeed(any(), any())
    }

    @Test
    fun countsReturnNonzeroOnly() {
        val rows = stubLibrary()

        mvc.get("/library/counts") {
            header("Authorization", "Bearer good")
        }.andExpect {
            status { isOk() }
            jsonPath("$.counts['${rows.feedA}']") { value(7) }
            jsonPath("$.counts['${rows.feedB}']") { doesNotExist() }
        }
    }
}
