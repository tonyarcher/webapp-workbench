package timesupapi.poller
import org.mockito.Mockito.mock
import org.mockito.kotlin.any
import org.mockito.kotlin.never
import org.mockito.kotlin.timeout
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import timesupapi.feeds.FeedSyncEntity
import timesupapi.feeds.FeedSyncRepo
import timesupapi.ingest.FeedBackoff
import timesupapi.ingest.IngestService
import timesupapi.ingest.IngestSync
import timesupapi.platform.RequestIds
import java.util.UUID
import kotlin.test.Test

class FeedPollerBranchTest {
    private val ingest = mock(IngestService::class.java)
    private val syncRows = mock(FeedSyncRepo::class.java)
    private val sync = mock(IngestSync::class.java)

    private fun poller(): FeedPoller = FeedPoller(ingest, syncRows, sync, FeedBackoff(syncRows))

    @Test
    fun pollErrorsAreLogged() {
        val badState = UUID.randomUUID()
        val badArg = UUID.randomUUID()
        whenever(syncRows.findDue(any(), any(), any())).thenReturn(
            listOf(FeedSyncEntity(feedId = badState), FeedSyncEntity(feedId = badArg)),
        )
        whenever(ingest.fetchAndIngest(badState)).thenThrow(IllegalStateException("boom"))
        whenever(ingest.fetchAndIngest(badArg)).thenThrow(IllegalArgumentException("bad"))
        val p = poller()
        p.scheduledTick()
        p.destroy()
        verify(ingest).fetchAndIngest(badState)
        verify(ingest).fetchAndIngest(badArg)
    }

    @Test
    fun stoppedTickReturnsEarly() {
        val p = poller()
        p.destroy()
        p.scheduledTick()
        verify(ingest, never()).fetchAndIngest(any())
    }

    @Test
    fun anonymousErrorLogged() {
        val feedId = UUID.randomUUID()
        whenever(syncRows.findDue(any(), any(), any())).thenReturn(listOf(FeedSyncEntity(feedId = feedId)))
        whenever(ingest.fetchAndIngest(feedId)).thenThrow(object : IllegalStateException() {})
        val p = poller()
        p.scheduledTick()
        p.destroy()
        verify(ingest).fetchAndIngest(feedId)
    }

    @Test
    fun queuedIdsPollAsyncWithRequestTrace() {
        val id = UUID.randomUUID()
        val p = poller()
        p.queue(listOf(id), RequestIds("req", "trace", "span"))
        verify(ingest, timeout(5_000L)).fetchAndIngest(id)
        p.destroy()
    }
}
