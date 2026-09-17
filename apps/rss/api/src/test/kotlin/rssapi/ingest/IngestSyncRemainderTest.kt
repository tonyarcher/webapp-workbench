package rssapi.ingest

import java.util.Optional
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import rssapi.persist.FeedRepo
import rssapi.persist.FeedSyncEntity
import rssapi.persist.FeedSyncRepo

class IngestSyncRemainderTest {
    private val feeds: FeedRepo = mock()
    private val sync: FeedSyncRepo = mock()
    private val ingest = IngestSync(feeds, sync)
    private val feedId = UUID.randomUUID()

    @Test
    fun saveNotModifiedKeepsError() {
        val row = FeedSyncEntity(feedId = feedId, lastError = "old")
        whenever(sync.findById(feedId)).thenReturn(Optional.of(row))
        ingest.saveNotModified(feedId, null, null)
        assertEquals("old", row.lastError)
        verify(sync).save(row)
    }

    @Test
    fun saveOkWithNulls() {
        val row = FeedSyncEntity(feedId = feedId, etag = "keep", lastModified = "keep")
        whenever(sync.findById(feedId)).thenReturn(Optional.of(row))
        ingest.saveOk(feedId, null, null)
        assertNull(row.lastError)
        assertEquals("keep", row.etag)
        verify(sync).save(row)
    }

    @Test
    fun ensureRowsFillsMissing() {
        val other = UUID.randomUUID()
        whenever(sync.findAllById(listOf(feedId, other))).thenReturn(
            listOf(FeedSyncEntity(feedId = feedId)),
        )
        ingest.ensureRows(listOf(feedId, other))
        verify(sync).saveAll(any<List<FeedSyncEntity>>())
    }

    @Test
    fun ensureRowsEmptySkips() {
        ingest.ensureRows(emptyList())
        verify(sync, never()).saveAll(any<List<FeedSyncEntity>>())
    }

    @Test
    fun clearFetchedMissingSkips() {
        whenever(sync.findById(feedId)).thenReturn(Optional.empty())
        ingest.clearFetched(feedId)
        verify(sync, never()).save(any<FeedSyncEntity>())
    }

    @Test
    fun metaPresent() {
        val row = FeedSyncEntity(feedId = feedId, etag = "e", lastModified = "m")
        whenever(sync.findById(feedId)).thenReturn(Optional.of(row))
        val (etag, mod) = ingest.meta(feedId)
        assertEquals("e", etag)
        assertEquals("m", mod)
    }

    @Test
    fun renameKeepsGoodTitle() {
        val feed = rssapi.persist.FeedEntity(xmlUrl = "https://example.com/rss", title = "Keep Me")
        ingest.maybeRename(feed, "New Name")
        assertEquals("Keep Me", feed.title)
        verify(feeds, never()).save(any())
    }

    @Test
    fun clearFetchedSaves() {
        val row = FeedSyncEntity(feedId = feedId)
        row.lastFetchedAt = java.time.Instant.now()
        whenever(sync.findById(feedId)).thenReturn(Optional.of(row))
        ingest.clearFetched(feedId)
        assertNull(row.lastFetchedAt)
    }
}
