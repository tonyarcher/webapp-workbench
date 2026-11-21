package rssapi.poller

import org.mockito.Mockito.mock
import org.mockito.kotlin.any
import org.mockito.kotlin.never
import org.mockito.kotlin.timeout
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.domain.Pageable
import rssapi.ingest.FeedBackoff
import rssapi.ingest.IngestService
import rssapi.ingest.IngestSync
import rssapi.persist.FeedSyncEntity
import rssapi.persist.FeedSyncRepo
import rssapi.persist.SubscriptionRepo
import java.time.Instant
import java.util.UUID
import kotlin.test.Test

class FeedPollerBranchTest {
    private val ingest = mock(IngestService::class.java)
    private val syncRows = mock(FeedSyncRepo::class.java)
    private val sync = mock(IngestSync::class.java)
    private val subs = mock(SubscriptionRepo::class.java)

    @Test
    fun pollErrorsAreLogged() {
        val badState = UUID.randomUUID()
        val badArg = UUID.randomUUID()
        whenever(syncRows.findDue(any(), any(), any<Pageable>())).thenReturn(
            listOf(
                FeedSyncEntity(feedId = badState, lastFetchedAt = null),
                FeedSyncEntity(feedId = badArg, lastFetchedAt = null),
            ),
        )
        whenever(subs.findMaxLastSeenByFeedId(any())).thenReturn(null)
        whenever(ingest.fetchAndIngest(badState)).thenThrow(IllegalStateException("boom"))
        whenever(ingest.fetchAndIngest(badArg)).thenThrow(IllegalArgumentException("bad"))
        val poller = FeedPoller(ingest, syncRows, sync, subs, FeedBackoff(syncRows))
        poller.scheduledTick()
        poller.destroy()
        verify(ingest).fetchAndIngest(badState)
        verify(ingest).fetchAndIngest(badArg)
    }

    @Test
    fun stoppedTickReturnsEarly() {
        val poller = FeedPoller(ingest, syncRows, sync, subs, FeedBackoff(syncRows))
        poller.destroy()
        poller.scheduledTick()
        verify(ingest, never()).fetchAndIngest(any())
    }

    @Test
    fun anonymousErrorLogged() {
        val feedId = UUID.randomUUID()
        whenever(syncRows.findDue(any(), any(), any<Pageable>())).thenReturn(
            listOf(FeedSyncEntity(feedId = feedId, lastFetchedAt = null)),
        )
        whenever(subs.findMaxLastSeenByFeedId(any())).thenReturn(null)
        whenever(ingest.fetchAndIngest(feedId)).thenThrow(object : IllegalStateException() {})
        val poller = FeedPoller(ingest, syncRows, sync, subs, FeedBackoff(syncRows))
        poller.scheduledTick()
        poller.destroy()
        verify(ingest).fetchAndIngest(feedId)
    }

    @Test
    fun queuedIdsPollAsync() {
        val id = UUID.randomUUID()
        whenever(syncRows.findDue(any(), any(), any<Pageable>())).thenReturn(emptyList())
        whenever(subs.findMaxLastSeenByFeedId(any())).thenReturn(null)
        val poller = FeedPoller(ingest, syncRows, sync, subs, FeedBackoff(syncRows))
        poller.queue(listOf(id, id))
        verify(ingest, timeout(5_000L)).fetchAndIngest(id)
        poller.destroy()
    }

    @Test
    fun forcedOverflowSkipsQuery() {
        val ids = (0 until 7).map { UUID.randomUUID() }
        val poller = FeedPoller(ingest, syncRows, sync, subs, FeedBackoff(syncRows))
        poller.queue(ids)
        ids.take(5).forEach { verify(ingest, timeout(5_000L)).fetchAndIngest(it) }
        verify(syncRows, never()).findDue(any(), any(), any<Pageable>())
        poller.destroy()
    }
}
