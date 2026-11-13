package rssapi.web

import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import rssapi.persist.ArticleRepo
import rssapi.persist.FeedEntity
import rssapi.persist.FeedRepo
import rssapi.persist.FeedSyncEntity
import rssapi.persist.FeedSyncRepo
import rssapi.persist.FolderEntity
import rssapi.persist.FolderFeedEntity
import rssapi.persist.FolderFeedRepo
import rssapi.persist.FolderRepo
import rssapi.persist.SavedSearchEntity
import rssapi.persist.SavedSearchRepo
import rssapi.persist.SubscriptionRepo
import java.time.Instant
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class LibraryServiceTest {
    private val folders: FolderRepo = mock()
    private val feeds: FeedRepo = mock()
    private val sync: FeedSyncRepo = mock()
    private val articles: ArticleRepo = mock()
    private val subs: SubscriptionRepo = mock()
    private val memberships: FolderFeedRepo = mock()
    private val savedSearches: SavedSearchRepo = mock()
    private val service = LibraryService(folders, feeds, sync, articles, subs, memberships, savedSearches)

    private val uid = UUID.randomUUID()
    private val folderId = UUID.randomUUID()
    private val feedA = UUID.randomUUID()
    private val feedB = UUID.randomUUID()

    private fun stubReads() {
        whenever(folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid)).thenReturn(
            listOf(FolderEntity(id = folderId, userId = uid, title = "Tech")),
        )
        whenever(savedSearches.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid)).thenReturn(emptyList())
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
    }

    @Test
    fun emptyLibrary() {
        whenever(folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid)).thenReturn(emptyList())
        whenever(savedSearches.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid)).thenReturn(emptyList())
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(emptyList())
        assertEquals(0, service.feeds(uid).size)
        assertEquals(0, service.counts(uid).counts.size)
        val lib = service.library(uid)
        assertEquals(0, lib.feeds.size)
        assertEquals(0, lib.folders.size)
        verifyNoInteractions(feeds)
    }

    @Test
    fun feedsAssembleWithoutArticles() {
        stubReads()

        val rows = service.feeds(uid)

        assertEquals(2, rows.size)
        assertEquals(listOf(folderId.toString()), rows.first { it.url == "https://a.example/rss" }.folderIds)
        assertTrue(rows.all { it.unread == 0 })
        verify(articles, never()).countUnread(any(), any())
        verifyNoInteractions(articles)
    }

    @Test
    fun countsMapNonzeroOnly() {
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(feedA, feedB))
        whenever(savedSearches.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid)).thenReturn(emptyList())
        whenever(articles.countUnreadByFeed(uid, listOf(feedA, feedB))).thenReturn(
            listOf(object : ArticleRepo.UnreadCount {
                override val feedId = feedA
                override val cnt = 7L
            }),
        )

        val counts = service.counts(uid)

        assertEquals(mapOf(feedA.toString() to 7), counts.counts)
    }

    @Test
    fun libraryMergesCounts() {
        stubReads()
        whenever(articles.countUnreadByFeed(uid, listOf(feedA, feedB))).thenReturn(
            listOf(object : ArticleRepo.UnreadCount {
                override val feedId = feedA
                override val cnt = 7L
            }),
        )

        val lib = service.library(uid)

        assertEquals(1, lib.folders.size)
        assertEquals(7, lib.feeds.first { it.url == "https://a.example/rss" }.unread)
        assertEquals(0, lib.feeds.first { it.url == "https://b.example/rss" }.unread)
    }

    @Test
    fun savedSearchCountsDerivedFromSpec() {
        val sid = UUID.randomUUID()
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(emptyList())
        whenever(folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid)).thenReturn(emptyList())
        whenever(savedSearches.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid)).thenReturn(
            listOf(SavedSearchEntity(id = sid, userId = uid, title = "Unread", query = "is:unread battery")),
        )
        whenever(
            articles.count(any<org.springframework.data.jpa.domain.Specification<rssapi.persist.ArticleEntity>>()),
        ).thenReturn(4L)

        val counts = service.counts(uid)

        assertEquals(mapOf(sid.toString() to 4), counts.savedSearchCounts)
    }

    @Test
    fun savedSearchWithoutEnforceableQueryCountsZero() {
        val sid = UUID.randomUUID()
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(emptyList())
        whenever(folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid)).thenReturn(emptyList())
        whenever(savedSearches.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid)).thenReturn(
            listOf(SavedSearchEntity(id = sid, userId = uid, title = "Empty", query = "has:video")),
        )

        val counts = service.counts(uid)

        assertEquals(emptyMap(), counts.savedSearchCounts)
        verify(
            articles,
            never(),
        ).count(any<org.springframework.data.jpa.domain.Specification<rssapi.persist.ArticleEntity>>())
    }
}
