package timesupapi.poller
import org.mockito.Mockito.mock
import org.mockito.kotlin.any
import org.mockito.kotlin.never
import org.mockito.kotlin.timeout
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.dao.DataRetrievalFailureException
import timesupapi.feeds.FeedSyncEntity
import timesupapi.feeds.FeedSyncRepo
import timesupapi.ingest.FeedBackoff
import timesupapi.ingest.IngestService
import timesupapi.ingest.IngestSync
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals

class FeedPollerTest {
    private val ingest = mock(IngestService::class.java)
    private val syncRows = mock(FeedSyncRepo::class.java)
    private val sync = mock(IngestSync::class.java)

    private fun poller(): FeedPoller = FeedPoller(ingest, syncRows, sync, FeedBackoff(syncRows))

    @Test
    fun dueRowsFillTheBatch() {
        val ids = (1..3).map { UUID.randomUUID() }
        whenever(syncRows.findDue(any(), any(), any())).thenReturn(ids.map { FeedSyncEntity(feedId = it) })
        val p = poller()
        p.scheduledTick()
        p.destroy()
        ids.forEach { verify(ingest).fetchAndIngest(it) }
    }

    @Test
    fun forcedAndDueWorkShareOneBatch() {
        val forced = UUID.randomUUID()
        val due = (1..4).map { UUID.randomUUID() }
        whenever(syncRows.findDue(any(), any(), any())).thenReturn(due.map { FeedSyncEntity(feedId = it) })
        val p = poller()
        p.queue(listOf(forced))
        verify(ingest, timeout(5_000L)).fetchAndIngest(forced)
        due.forEach { verify(ingest, timeout(5_000L)).fetchAndIngest(it) }
        p.destroy()
    }

    @Test
    fun duplicatesInOneQueueCallPollOnce() {
        val id = UUID.randomUUID()
        val p = poller()
        p.queue(List(100) { id })
        verify(ingest, timeout(5_000L)).fetchAndIngest(id)
        p.destroy()
        verify(ingest, org.mockito.kotlin.times(1)).fetchAndIngest(id)
    }

    @Test
    fun fullForcedBatchSkipsDueQuery() {
        val ids = (1..5).map { UUID.randomUUID() }
        val p = poller()
        p.queue(ids)
        ids.forEach { verify(ingest, timeout(5_000L)).fetchAndIngest(it) }
        verify(syncRows, never()).findDue(any(), any(), any())
        p.destroy()
    }

    @Test
    fun forcedOverflowIsProcessedAcrossBatches() {
        val ids = (1..7).map { UUID.randomUUID() }
        val p = poller()
        p.queue(ids)
        ids.forEach { verify(ingest, timeout(5_000L)).fetchAndIngest(it) }
        p.destroy()
    }

    @Test
    fun poisonFeedDoesNotAbortDrain() {
        val bad = UUID.randomUUID()
        val good = UUID.randomUUID()
        whenever(syncRows.findDue(any(), any(), any())).thenReturn(
            listOf(FeedSyncEntity(feedId = bad), FeedSyncEntity(feedId = good)),
        )
        whenever(ingest.fetchAndIngest(bad)).thenThrow(DataRetrievalFailureException("poison"))
        val p = poller()
        p.scheduledTick()
        p.destroy()
        verify(ingest).fetchAndIngest(bad)
        verify(ingest).fetchAndIngest(good)
    }

    @Test
    fun destroyedPollerSkipsTickAndQueue() {
        val id = UUID.randomUUID()
        val p = poller()
        p.destroy()
        p.scheduledTick()
        p.queue(listOf(id))
        verify(ingest, never()).fetchAndIngest(any())
    }

    @Test
    fun dueQueryReceivesTheRemainingBatchSize() {
        val forced = UUID.randomUUID()
        val p = poller()
        p.queue(listOf(forced))
        verify(syncRows, timeout(5_000L)).findDue(
            any(),
            any(),
            org.mockito.kotlin.check { page ->
                assertEquals(4, page.pageSize)
            },
        )
        p.destroy()
    }
}
