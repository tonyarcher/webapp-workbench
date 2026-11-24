package rssapi.feeds

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import rssapi.articles.ArticleRepo
import rssapi.boards.SavedSearchRepo
import rssapi.boards.SavedSearchService
import java.time.Instant
import java.util.UUID

class RecentCountsTest {
    private val folders: FolderRepo = mock()
    private val feeds: FeedRepo = mock()
    private val sync: FeedSyncRepo = mock()
    private val articles: ArticleRepo = mock()
    private val subs: SubscriptionRepo = mock()
    private val memberships: FolderFeedRepo = mock()
    private val searches: SavedSearchRepo = mock()
    private val searchCounts: SavedSearchService = mock()
    private val service = LibraryService(folders, feeds, sync, articles, subs, memberships, searches, searchCounts)
    private val uid = UUID.randomUUID()

    private fun count(feedId: UUID, cnt: Long) = object : ArticleRepo.RecentCount {
        override val feedId = feedId
        override val cnt = cnt
    }

    @Test
    fun reportsZeroForFeedsWithNoRecentArticles() {
        val a = UUID.randomUUID()
        val b = UUID.randomUUID()
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(a, b))
        whenever(articles.countRecentByFeed(any(), any())).thenReturn(listOf(count(a, 4)))

        val result = service.recentCounts(uid, 30)

        assertEquals(30, result.days)
        assertEquals(2, result.feeds.size)
        assertEquals(4, result.feeds.first { it.feedId == a.toString() }.count)
        assertEquals(0, result.feeds.first { it.feedId == b.toString() }.count)
    }

    @Test
    fun emptySubscriptionsReturnAnEmptyWindow() {
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(emptyList())

        val result = service.recentCounts(uid, 60)

        assertEquals(60, result.days)
        assertEquals(emptyList<FeedRecentJson>(), result.feeds)
    }

    @Test
    fun cutoffUsesTheRequestedWindow() {
        val feedId = UUID.randomUUID()
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(feedId))
        whenever(articles.countRecentByFeed(any(), any())).thenReturn(listOf(count(feedId, 9)))

        assertEquals(9, service.recentCounts(uid, 90).feeds.single().count)
    }

    @Test
    fun negativeCountsAreClamped() {
        val feedId = UUID.randomUUID()
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(feedId))
        whenever(articles.countRecentByFeed(any(), any())).thenReturn(listOf(count(feedId, -3)))

        assertEquals(0, service.recentCounts(uid, 30).feeds.single().count)
    }
}
