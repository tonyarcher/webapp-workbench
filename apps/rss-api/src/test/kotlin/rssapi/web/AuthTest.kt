package rssapi.web

import java.util.Optional
import java.util.UUID
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
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
import org.springframework.test.web.servlet.post
import rssapi.persist.ArticleRepo
import rssapi.persist.FeedEntity
import rssapi.persist.FeedRepo
import rssapi.persist.FeedSyncRepo
import rssapi.persist.FolderFeedRepo
import rssapi.persist.FolderRepo
import rssapi.persist.SubscriptionRepo
import rssapi.persist.UserEntity
import rssapi.persist.UserRepo
import kotlin.test.assertEquals
import kotlin.test.assertTrue

private fun jwt(sub: String, name: String): Jwt = Jwt.withTokenValue("tok")
    .header("alg", "RS256")
    .claim("sub", sub)
    .claim("preferred_username", name)
    .claim("aud", listOf("rss-reader"))
    .build()

@WebMvcTest(LibraryController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, IdentityUser::class)
class AuthTest {
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

    @MockitoBean
    lateinit var membershipService: MembershipService

    @Test
    fun libraryWithoutTokenIs401() {
        val result = mvc.get("/library").andReturn()
        assertEquals(401, result.response.status)
        assertEquals("""{"error":"unauthorized"}""", result.response.contentAsString)
    }

    @Test
    fun libraryWithBadTokenIs401() {
        whenever(decoder.decode(any())).thenThrow(org.springframework.security.oauth2.jwt.BadJwtException("bad"))
        val result = mvc.get("/library") {
            header("Authorization", "Bearer nope")
        }.andReturn()
        assertEquals(401, result.response.status)
    }

    @Test
    fun validTokenProvisionsIdentityUser() {
        whenever(decoder.decode(any())).thenReturn(jwt("idp-1", "alice"))
        whenever(users.findBySubject("idp-1")).thenReturn(null)
        val saved = UserEntity(id = UUID.randomUUID(), label = "identity", subject = "idp-1", username = "alice")
        whenever(users.save(any())).thenReturn(saved)
        whenever(folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(any())).thenReturn(emptyList())
        whenever(subs.findFeedIdsByUserId(any())).thenReturn(emptyList())
        whenever(membershipService.ownedFolderIds(any(), any())).thenReturn(emptyList())

        val result = mvc.get("/library") {
            header("Authorization", "Bearer good")
        }.andReturn()
        assertEquals(200, result.response.status)
        assertTrue(result.response.contentAsString.contains("\"feeds\":[]"))

        val captor = argumentCaptor<UserEntity>()
        verify(users).save(captor.capture())
        assertEquals("idp-1", captor.firstValue.subject)
        assertEquals("alice", captor.firstValue.username)
    }

    @Test
    fun knownSubjectSkipsInsert() {
        val existing = UserEntity(id = UUID.randomUUID(), label = "identity", subject = "idp-2", username = "bob")
        whenever(decoder.decode(any())).thenReturn(jwt("idp-2", "bob"))
        whenever(users.findBySubject("idp-2")).thenReturn(existing)
        whenever(folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(any())).thenReturn(emptyList())
        whenever(subs.findFeedIdsByUserId(any())).thenReturn(emptyList())
        whenever(membershipService.ownedFolderIds(any(), any())).thenReturn(emptyList())

        val result = mvc.get("/library") {
            header("Authorization", "Bearer good")
        }.andReturn()
        assertEquals(200, result.response.status)
        verify(users, org.mockito.kotlin.never()).save(any())
    }
}

@WebMvcTest(FeedController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, IdentityUser::class)
class SharedPoolTest {
    @Autowired
    lateinit var mvc: MockMvc

    @MockitoBean
    lateinit var decoder: JwtDecoder

    @MockitoBean
    lateinit var users: UserRepo

    @MockitoBean
    lateinit var feeds: FeedRepo

    @MockitoBean
    lateinit var folders: FolderRepo

    @MockitoBean
    lateinit var memberships: FolderFeedRepo

    @MockitoBean
    lateinit var ingest: rssapi.ingest.IngestService

    @MockitoBean
    lateinit var sync: rssapi.ingest.IngestSync

    @MockitoBean
    lateinit var articleRepo: ArticleRepo

    @MockitoBean
    lateinit var syncRows: FeedSyncRepo

    @MockitoBean
    lateinit var subs: SubscriptionRepo

    @MockitoBean
    lateinit var membershipService: MembershipService

    private fun asUser(sub: String, id: UUID) {
        whenever(decoder.decode(any())).thenReturn(jwt(sub, sub))
        whenever(users.findBySubject(sub)).thenReturn(UserEntity(id = id, subject = sub))
        whenever(folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(any())).thenReturn(emptyList())
    }

    private fun stubPool(feed: FeedEntity, feedId: UUID) {
        whenever(feeds.findByXmlUrl("https://example.com/rss")).thenReturn(feed)
        whenever(feeds.findById(feedId)).thenReturn(Optional.of(feed))
        val subscribed = mutableSetOf<Pair<UUID, UUID>>()
        whenever(subs.existsByUserIdAndFeedId(any(), any())).thenAnswer { inv ->
            subscribed.contains(inv.getArgument<UUID>(0) to inv.getArgument<UUID>(1))
        }
        whenever(subs.save(any())).thenAnswer { inv ->
            val entity = inv.getArgument<rssapi.persist.SubscriptionEntity>(0)
            subscribed.add(entity.userId to entity.feedId)
            entity
        }
        whenever(articleRepo.countUnread(any(), any())).thenReturn(0L)
        whenever(syncRows.findById(feedId)).thenReturn(Optional.empty())
        whenever(membershipService.ownedFolderIds(any(), any())).thenReturn(emptyList())
    }

    private fun postFeed(token: String, body: String = """{"url":"https://example.com/rss"}"""): Int {
        val result = mvc.post("/feeds") {
            header("Authorization", "Bearer $token")
            contentType = org.springframework.http.MediaType.APPLICATION_JSON
            content = body
        }.andReturn()
        return result.response.status
    }

    @Test
    fun twoUsersShareOneFeedRow() {
        val feedId = UUID.randomUUID()
        stubPool(FeedEntity(id = feedId, xmlUrl = "https://example.com/rss", title = "example.com"), feedId)

        val alice = UUID.randomUUID()
        asUser("alice-sub", alice)
        assertEquals(200, postFeed("a"))

        val bob = UUID.randomUUID()
        asUser("bob-sub", bob)
        assertEquals(200, postFeed("b"))

        verify(feeds, org.mockito.kotlin.never()).save(any())
        verify(subs).save(org.mockito.kotlin.check {
            assertEquals(alice, it.userId)
            assertEquals(feedId, it.feedId)
        })
        verify(subs).save(org.mockito.kotlin.check {
            assertEquals(bob, it.userId)
            assertEquals(feedId, it.feedId)
        })
    }

    @Test
    fun reAddWithFoldersIsIdempotent() {
        val feedId = UUID.randomUUID()
        stubPool(FeedEntity(id = feedId, xmlUrl = "https://example.com/rss", title = "example.com"), feedId)
        val folderId = UUID.randomUUID()
        val uid = UUID.randomUUID()
        whenever(folders.findByUserIdAndIdIn(any(), any())).thenReturn(
            listOf(rssapi.persist.FolderEntity(id = folderId, userId = uid, title = "News")),
        )
        whenever(memberships.existsByFolderIdAndFeedId(folderId, feedId)).thenReturn(true)
        asUser("carol-sub", uid)
        val body = """{"url":"https://example.com/rss","folderIds":["$folderId"]}"""
        assertEquals(200, postFeed("c", body))
        assertEquals(200, postFeed("c", body))
        verify(memberships, org.mockito.kotlin.never()).save(any())
    }
}
