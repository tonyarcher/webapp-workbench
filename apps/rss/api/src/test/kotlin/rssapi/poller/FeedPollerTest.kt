package rssapi.poller

import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.domain.Pageable
import rssapi.ingest.IngestService
import rssapi.ingest.IngestSync
import rssapi.persist.FeedSyncEntity
import rssapi.persist.FeedSyncRepo
import rssapi.persist.SubscriptionRepo
import java.time.Duration
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals

class FeedPollerTest {
    private val ingest = mock(IngestService::class.java)
    private val syncRows = mock(FeedSyncRepo::class.java)
    private val sync = mock(IngestSync::class.java)
    private val subs = mock(SubscriptionRepo::class.java)
    private val now = Instant.now()
    private val baseMs = 15 * 60_000L

    private fun row(feedId: UUID, fetched: Instant?): FeedSyncEntity =
        FeedSyncEntity(feedId = feedId, lastFetchedAt = fetched)

    private fun tickOnce(): FeedPoller {
        val poller = FeedPoller(ingest, syncRows, sync, subs)
        poller.scheduledTick()
        poller.destroy()
        return poller
    }

    @Test
    fun skipsFeedsOnlySeenByStaleUsers() {
        val activeFeed = UUID.randomUUID()
        val staleFeed = UUID.randomUUID()
        val fetched = now.minus(Duration.ofHours(2))
        whenever(syncRows.findDue(any(), any<Pageable>())).thenReturn(
            listOf(row(activeFeed, fetched), row(staleFeed, fetched)),
        )
        whenever(subs.findMaxLastSeenByFeedId(activeFeed)).thenReturn(now.minus(Duration.ofDays(1)))
        whenever(subs.findMaxLastSeenByFeedId(staleFeed)).thenReturn(now.minus(Duration.ofDays(31)))

        tickOnce()

        val captor = argumentCaptor<UUID>()
        verify(sync).ensureRow(captor.capture())
        assertEquals(listOf(activeFeed), captor.allValues)
        verify(ingest).pollFeed(activeFeed)
        verify(ingest, never()).pollFeed(staleFeed)
    }

    @Test
    fun throttlesRecentlyFetchedInactiveOnlyFeeds() {
        val feedId = UUID.randomUUID()
        val fetched = now.minus(Duration.ofHours(2))
        whenever(syncRows.findDue(any(), any<Pageable>())).thenReturn(listOf(row(feedId, fetched)))
        // 10 days quiet needs a full day of staleness; 2 hours is not due.
        whenever(subs.findMaxLastSeenByFeedId(feedId)).thenReturn(now.minus(Duration.ofDays(10)))

        tickOnce()

        verify(sync, never()).ensureRow(any())
        verify(ingest, never()).pollFeed(any())
    }

    @Test
    fun pollsStaleEnoughInactiveOnlyFeeds() {
        val feedId = UUID.randomUUID()
        val fetched = now.minus(Duration.ofDays(3))
        whenever(syncRows.findDue(any(), any<Pageable>())).thenReturn(listOf(row(feedId, fetched)))
        whenever(subs.findMaxLastSeenByFeedId(feedId)).thenReturn(now.minus(Duration.ofDays(10)))

        tickOnce()

        verify(ingest).pollFeed(feedId)
    }

    @Test
    fun unknownRecencyStaysEligible() {
        val feedId = UUID.randomUUID()
        val fetched = now.minus(Duration.ofHours(1))
        whenever(syncRows.findDue(any(), any<Pageable>())).thenReturn(listOf(row(feedId, fetched)))
        whenever(subs.findMaxLastSeenByFeedId(feedId)).thenReturn(null)

        tickOnce()

        verify(ingest).pollFeed(feedId)
    }

    @Test
    fun lookupFailureFallsBackToEligible() {
        val feedId = UUID.randomUUID()
        whenever(syncRows.findDue(any(), any<Pageable>())).thenReturn(
            listOf(row(feedId, now.minus(Duration.ofHours(1)))),
        )
        whenever(subs.findMaxLastSeenByFeedId(feedId)).thenThrow(RuntimeException("db down"))

        tickOnce()

        verify(ingest).pollFeed(feedId)
    }

    @Test
    fun poisonFeedDoesNotAbortDrain() {
        val badFeed = UUID.randomUUID()
        val goodFeed = UUID.randomUUID()
        val fetched = now.minus(Duration.ofHours(2))
        whenever(syncRows.findDue(any(), any<Pageable>())).thenReturn(
            listOf(row(badFeed, fetched), row(goodFeed, fetched)),
        )
        whenever(subs.findMaxLastSeenByFeedId(badFeed)).thenReturn(now.minus(Duration.ofDays(1)))
        whenever(subs.findMaxLastSeenByFeedId(goodFeed)).thenReturn(now.minus(Duration.ofDays(1)))
        whenever(ingest.pollFeed(badFeed)).thenThrow(
            org.springframework.dao.DataRetrievalFailureException("poison"),
        )

        tickOnce()

        verify(ingest).pollFeed(badFeed)
        verify(ingest).pollFeed(goodFeed)
    }

    @Test
    fun destroyedPollerSkipsTick() {
        val feedId = UUID.randomUUID()
        whenever(syncRows.findDue(any(), any<Pageable>())).thenReturn(
            listOf(row(feedId, now.minus(Duration.ofHours(2)))),
        )
        whenever(subs.findMaxLastSeenByFeedId(feedId)).thenReturn(null)

        val poller = FeedPoller(ingest, syncRows, sync, subs)
        poller.destroy()
        poller.scheduledTick()

        verify(ingest, never()).pollFeed(any())
    }
}
