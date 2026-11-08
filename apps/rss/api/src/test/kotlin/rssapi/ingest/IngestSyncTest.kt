package rssapi.ingest

import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import rssapi.persist.FeedEntity
import rssapi.persist.FeedRepo
import rssapi.persist.FeedSyncEntity
import rssapi.persist.FeedSyncRepo
import java.util.Optional
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

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
    fun maybeUpdateMetaSetsFields() {
        val feed = FeedEntity(xmlUrl = "https://example.com/rss", title = "t")
        ingest.maybeUpdateMeta(feed, "https://example.com", "https://example.com/icon.png")
        assertEquals("https://example.com", feed.siteUrl)
        assertEquals("https://example.com/icon.png", feed.icon)
        verify(feeds).save(feed)
    }

    @Test
    fun maybeUpdateMetaSkipsNullsAndSame() {
        val feed =
            FeedEntity(
                xmlUrl = "https://example.com/rss",
                title = "t",
                siteUrl = "https://example.com",
                icon = "https://example.com/icon.png",
            )
        ingest.maybeUpdateMeta(feed, "https://example.com", "https://example.com/icon.png")
        ingest.maybeUpdateMeta(feed, null, null)
        verify(feeds, never()).save(any())
    }

    @Test
    fun saveNotModifiedUpdatesRow() {
        val row = FeedSyncEntity(feedId = feedId, lastError = "old")
        whenever(sync.findById(feedId)).thenReturn(Optional.of(row))
        ingest.saveNotModified(feedId, "e2", "m2")
        assertEquals("e2", row.etag)
        assertEquals("m2", row.lastModified)
        verify(sync).save(row)
    }

    @Test
    fun ensureRowsCreatesMissing() {
        whenever(sync.findAllById(any())).thenReturn(emptyList())
        ingest.ensureRows(listOf(feedId))
        verify(sync).saveAll(any<List<FeedSyncEntity>>())
    }

    @Test
    fun saveNotModifiedCreatesRow() {
        whenever(sync.findById(feedId)).thenReturn(Optional.empty())
        ingest.saveNotModified(feedId, "e", "m")
        verify(sync).save(any())
    }

    @Test
    fun ensureRowsEmptySkips() {
        ingest.ensureRows(emptyList())
        verify(sync, never()).saveAll(any<List<FeedSyncEntity>>())
    }

    @Test
    fun ensureRowsAllExistSkips() {
        whenever(sync.findAllById(any())).thenReturn(listOf(FeedSyncEntity(feedId = feedId)))
        ingest.ensureRows(listOf(feedId))
        verify(sync, never()).saveAll(any<List<FeedSyncEntity>>())
    }

    @Test
    fun metaMissingIsNulls() {
        whenever(sync.findById(feedId)).thenReturn(Optional.empty())
        val (etag, mod) = ingest.meta(feedId)
        assertNull(etag)
        assertNull(mod)
    }
}
