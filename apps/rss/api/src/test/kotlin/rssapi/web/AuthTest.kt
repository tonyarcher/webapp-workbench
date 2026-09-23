package rssapi.web

import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
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
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put
import rssapi.persist.ArticleRepo
import rssapi.persist.FeedEntity
import rssapi.persist.FeedRepo
import rssapi.persist.FeedSyncRepo
import rssapi.persist.FolderFeedRepo
import rssapi.persist.FolderRepo
import rssapi.persist.SubscriptionEntity
import rssapi.persist.SubscriptionRepo
import rssapi.persist.UserEntity
import rssapi.persist.UserRepo
import java.util.Optional
import java.util.UUID
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
    lateinit var service: LibraryService

    @Test
    fun libraryWithoutTokenIs401() {
        val result = mvc.get("/library") {
            header("X-Api-Version", "1")
        }.andReturn()
        assertEquals(HttpStatus.UNAUTHORIZED.value(), result.response.status)
        assertEquals("""{"error":"unauthorized"}""", result.response.contentAsString)
    }

    @Test
    fun libraryWithBadTokenIs401() {
        whenever(decoder.decode(any())).thenThrow(org.springframework.security.oauth2.jwt.BadJwtException("bad"))
        val result = mvc.get("/library") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer nope")
        }.andReturn()
        assertEquals(HttpStatus.UNAUTHORIZED.value(), result.response.status)
    }

    @Test
    fun validTokenProvisionsIdentityUser() {
        whenever(decoder.decode(any())).thenReturn(jwt("idp-1", "alice"))
        whenever(users.findBySubject("idp-1")).thenReturn(null)
        val saved = UserEntity(id = UUID.randomUUID(), label = "identity", subject = "idp-1", username = "alice")
        whenever(users.save(any<UserEntity>())).thenReturn(saved)
        whenever(service.library(any())).thenReturn(LibraryJson(emptyList(), emptyList()))

        val result = mvc.get("/library") {
            header("X-Api-Version", "1")
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
        val existing = UserEntity(
            id = UUID.randomUUID(),
            label = "identity",
            subject = "idp-2",
            username = "bob",
            lastSeenAt = java.time.Instant.now(),
        )
        whenever(decoder.decode(any())).thenReturn(jwt("idp-2", "bob"))
        whenever(users.findBySubject("idp-2")).thenReturn(existing)
        whenever(service.library(any())).thenReturn(LibraryJson(emptyList(), emptyList()))

        val result = mvc.get("/library") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
        }.andReturn()
        assertEquals(200, result.response.status)
        verify(users, org.mockito.kotlin.never()).save(any())
    }

    @Test
    fun staleLastSeenIsTouched() {
        val existing = UserEntity(
            id = UUID.randomUUID(),
            label = "identity",
            subject = "idp-3",
            username = "carol",
            lastSeenAt = java.time.Instant.now().minusSeconds(2 * 60 * 60),
        )
        whenever(decoder.decode(any())).thenReturn(jwt("idp-3", "carol"))
        whenever(users.findBySubject("idp-3")).thenReturn(existing)
        whenever(users.save(any<UserEntity>())).thenAnswer { it.getArgument<UserEntity>(0) }
        whenever(service.library(any())).thenReturn(LibraryJson(emptyList(), emptyList()))
        val oldSeen = existing.lastSeenAt!!

        val result = mvc.get("/library") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
        }.andReturn()
        assertEquals(200, result.response.status)

        val captor = argumentCaptor<UserEntity>()
        verify(users).save(captor.capture())
        assertTrue(captor.firstValue.lastSeenAt!!.isAfter(oldSeen))
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
        whenever(subs.save(any<SubscriptionEntity>())).thenAnswer { inv ->
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
            header("X-Api-Version", "1")
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
        verify(subs).save(
            org.mockito.kotlin.check {
                assertEquals(alice, it.userId)
                assertEquals(feedId, it.feedId)
            },
        )
        verify(subs).save(
            org.mockito.kotlin.check {
                assertEquals(bob, it.userId)
                assertEquals(feedId, it.feedId)
            },
        )
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

    @Test
    fun createValidates() {
        asUser("dave-sub", UUID.randomUUID())
        assertEquals(HttpStatus.BAD_REQUEST.value(), postFeed("d", """{}"""))
        assertEquals(HttpStatus.BAD_REQUEST.value(), postFeed("d", """{"url":"ftp://example.com/rss"}"""))
        assertEquals(
            HttpStatus.BAD_REQUEST.value(),
            postFeed("d", """{"url":"https://example.com/rss","folderIds":["nope"]}"""),
        )
    }

    @Test
    fun deleteFlow() {
        val feedId = UUID.randomUUID()
        val feed = FeedEntity(id = feedId, xmlUrl = "https://example.com/rss", title = "example.com")
        stubPool(feed, feedId)
        val uid = UUID.randomUUID()
        asUser("erin-sub", uid)
        assertDeleteRejects()
        whenever(subs.countByFeedId(feedId)).thenReturn(1L)
        whenever(feeds.findById(feedId)).thenReturn(Optional.of(feed))
        whenever(subs.existsByUserIdAndFeedId(uid, feedId)).thenReturn(true)
        val gone = mvc.delete("/feeds/$feedId") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer e")
        }.andReturn()
        assertEquals(200, gone.response.status)
        verify(subs).deleteByUserIdAndFeedId(uid, feedId)
    }

    @Test
    fun deleteSoleSubscriberRemovesFeed() {
        val feedId = UUID.randomUUID()
        val feed = FeedEntity(id = feedId, xmlUrl = "https://example.com/rss", title = "example.com")
        stubPool(feed, feedId)
        val uid = UUID.randomUUID()
        asUser("gina-sub", uid)
        whenever(subs.existsByUserIdAndFeedId(uid, feedId)).thenReturn(true)
        whenever(subs.countByFeedId(feedId)).thenReturn(0L)
        whenever(feeds.findById(feedId)).thenReturn(Optional.of(feed))
        val gone = mvc.delete("/feeds/$feedId") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer g")
        }.andReturn()
        assertEquals(200, gone.response.status)
        verify(feeds).delete(feed)
    }

    @Test
    fun createNewFeedSaves() {
        val feedId = UUID.randomUUID()
        val uid = UUID.randomUUID()
        asUser("hank-sub", uid)
        stubNewFeed(feedId)
        val result = mvc.post("/feeds") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer h")
            contentType = org.springframework.http.MediaType.APPLICATION_JSON
            content = """{"url":"https://new.example/rss"}"""
        }.andReturn()
        assertEquals(200, result.response.status)
        verify(feeds).save(any())
    }

    private fun stubNewFeed(feedId: UUID) {
        whenever(feeds.findByXmlUrl("https://new.example/rss")).thenReturn(null)
        whenever(feeds.save(any<FeedEntity>())).thenAnswer { inv ->
            val e = inv.getArgument<FeedEntity>(0)
            e.id = feedId
            e
        }
        whenever(subs.existsByUserIdAndFeedId(any(), any())).thenReturn(false, true)
        whenever(articleRepo.countUnread(any(), any())).thenReturn(0L)
        whenever(syncRows.findById(feedId)).thenReturn(Optional.empty())
        whenever(membershipService.ownedFolderIds(any(), any())).thenReturn(emptyList())
        whenever(feeds.findById(feedId)).thenReturn(
            Optional.of(FeedEntity(id = feedId, xmlUrl = "https://new.example/rss", title = "new.example")),
        )
    }

    @Test
    fun setFoldersMismatch() {
        val feedId = UUID.randomUUID()
        stubPool(FeedEntity(id = feedId, xmlUrl = "https://example.com/rss", title = "example.com"), feedId)
        val uid = UUID.randomUUID()
        asUser("iris-sub", uid)
        whenever(subs.existsByUserIdAndFeedId(uid, feedId)).thenReturn(true)
        whenever(folders.findByUserIdAndIdIn(any(), any())).thenReturn(emptyList())
        val res = mvc.put("/feeds/$feedId/folders") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer i")
            contentType = org.springframework.http.MediaType.APPLICATION_JSON
            content = """{"folderIds":["${UUID.randomUUID()}"]}"""
        }.andReturn()
        assertEquals(HttpStatus.BAD_REQUEST.value(), res.response.status)
    }

    private fun assertDeleteRejects() {
        val bad = mvc.delete("/feeds/nope") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer e")
        }.andReturn()
        assertEquals(HttpStatus.BAD_REQUEST.value(), bad.response.status)
        val missing = mvc.delete("/feeds/${UUID.randomUUID()}") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer e")
        }.andReturn()
        assertEquals(HttpStatus.NOT_FOUND.value(), missing.response.status)
    }

    @Test
    fun setFoldersValidates() {
        val feedId = UUID.randomUUID()
        stubPool(FeedEntity(id = feedId, xmlUrl = "https://example.com/rss", title = "example.com"), feedId)
        val uid = UUID.randomUUID()
        asUser("fred-sub", uid)
        fun putFolders(id: String, body: String): Int = mvc.put("/feeds/$id/folders") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer f")
            contentType = org.springframework.http.MediaType.APPLICATION_JSON
            content = body
        }.andReturn().response.status
        assertEquals(HttpStatus.BAD_REQUEST.value(), putFolders("nope", """{"folderIds":[]}"""))
        assertEquals(HttpStatus.BAD_REQUEST.value(), putFolders("$feedId", """{}"""))
        assertEquals(HttpStatus.NOT_FOUND.value(), putFolders("${UUID.randomUUID()}", """{"folderIds":[]}"""))
        val folderId = UUID.randomUUID()
        whenever(folders.findByUserIdAndIdIn(any(), any())).thenReturn(
            listOf(rssapi.persist.FolderEntity(id = folderId, userId = uid, title = "N")),
        )
        whenever(subs.existsByUserIdAndFeedId(uid, feedId)).thenReturn(true)
        assertEquals(200, putFolders("$feedId", """{"folderIds":["$folderId"]}"""))
    }
}
