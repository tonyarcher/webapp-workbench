package timesupapi.ingest
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import timesupapi.feeds.FeedSyncEntity
import timesupapi.feeds.FeedSyncRepo
import java.time.Instant
import java.util.Optional
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class FeedBackoffTest {
    private val sync: FeedSyncRepo = mock()
    private val backoff = FeedBackoff(sync)
    private val feedId = UUID.randomUUID()

    @Test
    fun clearDropsNextAttemptButKeepsFailures() {
        val row = FeedSyncEntity(feedId = feedId, consecutiveFailures = 4, nextAttemptAt = Instant.MAX)
        whenever(sync.findById(feedId)).thenReturn(Optional.of(row))
        backoff.clear(feedId)
        assertNull(row.nextAttemptAt)
        assertEquals(4, row.consecutiveFailures)
        verify(sync).save(row)
    }

    @Test
    fun clearIgnoresMissingRow() {
        whenever(sync.findById(feedId)).thenReturn(Optional.empty())
        backoff.clear(feedId)
    }
}
