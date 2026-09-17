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
import rssapi.persist.FeedEntity
import rssapi.persist.FeedRepo
import rssapi.persist.FeedSyncEntity
import rssapi.persist.FeedSyncRepo

class IngestSyncTest {
    private val feeds: FeedRepo = mock()
    private val sync: FeedSyncRepo = mock()
    private val ingest = IngestSync(feeds, sync)
    private val feedId = UUID.randomUUID()

    @Test
    fun renameOnlyFromUntitled() {
        val feed = FeedEntity(xmlUrl = "https://example.com/rss", title = "Untitled feed")
        ingest.maybeRename(feed, "Example")
        assertEquals("Example", feed.title)
        verify(feeds).save(feed)
    }

    @Test
    fun renameSkipsBadTitles() {
        val feed = FeedEntity(xmlUrl = "https://example.com/rss", title = "Old")
        ingest.maybeRename(feed, "")
        ingest.maybeRename(feed, "Untitled feed")
        assertEquals("Old", feed.title)
        verify(feeds, never()).save(any())
    }

    @Test
    fun renameEmptyCurrent() {
        val feed = FeedEntity(xmlUrl = "https://example.com/rss", title = "")
        ingest.maybeRename(feed, "Example")
        assertEquals("Example", feed.title)
        verify(feeds).save(feed)
    }

    @Test
    fun saveErrorCreatesRow() {
        whenever(sync.findById(feedId)).thenReturn(Optional.empty())
        ingest.saveError(feedId, "boom")
        verify(sync).save(any())
    }

    @Test
    fun saveOkClearsError() {
        val row = FeedSyncEntity(feedId = feedId, lastError = "old")
        whenever(sync.findById(feedId)).thenReturn(Optional.of(row))
        ingest.saveOk(feedId, "e1", "m1")
        assertNull(row.lastError)
        assertEquals("e1", row.etag)
        verify(sync).save(row)
    }

    @Test
    fun ensureRowSkipsExisting() {
        whenever(sync.existsById(feedId)).thenReturn(true)
        ingest.ensureRow(feedId)
        verify(sync, never()).save(any())
    }

    @Test
    fun ensureRowCreatesMissing() {
        whenever(sync.existsById(feedId)).thenReturn(false)
        ingest.ensureRow(feedId)
        verify(sync).save(any())
    }

    @Test
    fun metaMissingIsNulls() {
        whenever(sync.findById(feedId)).thenReturn(Optional.empty())
        val (etag, mod) = ingest.meta(feedId)
        assertNull(etag)
        assertNull(mod)
    }
}
