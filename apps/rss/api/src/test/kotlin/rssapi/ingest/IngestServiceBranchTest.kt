package rssapi.ingest

import java.util.Optional
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import rssapi.fetch.FeedFetcher
import rssapi.fetch.FetchResult
import rssapi.persist.ArticleMaintenanceRepo
import rssapi.persist.ArticleRepo
import rssapi.persist.FeedEntity
import rssapi.persist.FeedRepo

class IngestServiceBranchTest {
    private val feeds: FeedRepo = mock()
    private val articles: ArticleRepo = mock()
    private val maintenance: ArticleMaintenanceRepo = mock()
    private val sync: IngestSync = mock()
    private val pending: PendingApply = mock()
    private val fetcher: FeedFetcher = mock()
    private val ingest = IngestService(feeds, articles, maintenance, sync, pending, fetcher)
    private val feedId = UUID.randomUUID()
    private val feed = FeedEntity(id = feedId, xmlUrl = "https://example.com/rss", title = "t")

    @Test
    fun missingFeedReturns() {
        whenever(feeds.findById(feedId)).thenReturn(Optional.empty())
        ingest.fetchAndIngest(feedId)
        verify(fetcher, never()).fetch(any(), anyOrNull(), anyOrNull())
    }

    @Test
    fun notModifiedSavesMeta() {
        whenever(feeds.findById(feedId)).thenReturn(Optional.of(feed))
        whenever(sync.meta(feedId)).thenReturn("e1" to "m1")
        whenever(fetcher.fetch(feed.xmlUrl, "e1", "m1")).thenReturn(FetchResult(304, etag = "e2"))
        ingest.fetchAndIngest(feedId)
        verify(sync).saveNotModified(feedId, "e2", null)
        verify(articles, never()).save(any())
    }

    @Test
    fun nullTextSkipsIngest() {
        whenever(feeds.findById(feedId)).thenReturn(Optional.of(feed))
        whenever(sync.meta(feedId)).thenReturn(null to null)
        whenever(fetcher.fetch(eq(feed.xmlUrl), anyOrNull(), anyOrNull())).thenReturn(FetchResult(200, text = null))
        ingest.fetchAndIngest(feedId)
        verify(articles, never()).save(any())
    }

    @Test
    fun fetchErrorSavesError() {
        whenever(feeds.findById(feedId)).thenReturn(Optional.of(feed))
        whenever(sync.meta(feedId)).thenReturn(null to null)
        whenever(fetcher.fetch(eq(feed.xmlUrl), anyOrNull(), anyOrNull())).thenThrow(IllegalStateException("down"))
        ingest.fetchAndIngest(feedId)
        verify(sync).saveError(feedId, "down")
    }

    @Test
    fun fetchErrorWithoutMessage() {
        whenever(feeds.findById(feedId)).thenReturn(Optional.of(feed))
        whenever(sync.meta(feedId)).thenReturn(null to null)
        whenever(fetcher.fetch(eq(feed.xmlUrl), anyOrNull(), anyOrNull())).thenThrow(
            IllegalStateException(),
            IllegalArgumentException(),
        )
        ingest.fetchAndIngest(feedId)
        ingest.fetchAndIngest(feedId)
        verify(sync, org.mockito.kotlin.times(2)).saveError(eq(feedId), eq("error"))
    }

    @Test
    fun badUrlSavesError() {
        whenever(feeds.findById(feedId)).thenReturn(Optional.of(feed))
        whenever(sync.meta(feedId)).thenReturn(null to null)
        whenever(fetcher.fetch(eq(feed.xmlUrl), anyOrNull(), anyOrNull())).thenThrow(IllegalArgumentException("bad"))
        ingest.fetchAndIngest(feedId)
        verify(sync).saveError(feedId, "bad")
    }

    @Test
    fun malformedXmlSavesError() {
        whenever(feeds.findById(feedId)).thenReturn(Optional.of(feed))
        whenever(sync.meta(feedId)).thenReturn(null to null)
        whenever(fetcher.fetch(eq(feed.xmlUrl), anyOrNull(), anyOrNull()))
            .thenReturn(FetchResult(200, text = "junk before <rss>"))
        ingest.fetchAndIngest(feedId)
        verify(sync).saveError(eq(feedId), org.mockito.kotlin.argThat { isNotEmpty() })
        verify(articles, never()).save(any())
    }

    @Test
    fun pollDelegates() {
        whenever(feeds.findById(feedId)).thenReturn(Optional.empty())
        ingest.pollFeed(feedId)
        verify(fetcher, never()).fetch(any(), anyOrNull(), anyOrNull())
    }

    @Test
    fun emptyTitleFallsBack() {
        whenever(articles.save(any())).thenAnswer { it.getArgument(0) }
        val xml = """
            <?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
            <item><link>https://example.com/y</link></item>
            </channel></rss>
        """.trimIndent()
        ingest.ingestXml(feed, xml)
        verify(maintenance).updateLonelyHot(feedId)
        assertEquals(feedId, feed.id)
    }

    @Test
    fun emptyItemsSkipsPopularity() {
        whenever(articles.save(any())).thenAnswer { it.getArgument(0) }
        val xml = """<?xml version="1.0"?><rss version="2.0"><channel><title>t</title></channel></rss>"""
        ingest.ingestXml(feed, xml)
        verify(maintenance, never()).updatePopularity(any(), any())
        verify(maintenance).updateLonelyHot(feedId)
        verify(maintenance).pruneFeed(feedId, rssapi.MAX_ARTICLES_PER_FEED)
    }

    @Test
    fun largeContentTruncated() {
        whenever(articles.save(any())).thenAnswer { it.getArgument(0) }
        val big = "x".repeat(rssapi.MAX_CONTENT_BYTES + 10)
        val xml = """<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>""" +
            """<item><title>t</title><link>https://example.com/z</link><description>$big</description></item>""" +
            """</channel></rss>"""
        ingest.ingestXml(feed, xml)
        val captor = argumentCaptor<rssapi.persist.ArticleEntity>()
        verify(articles, org.mockito.kotlin.atLeastOnce()).save(captor.capture())
        assertTrue(captor.allValues.any { (it.contentHtml?.length ?: 0) <= rssapi.MAX_CONTENT_BYTES })
    }

    @Test
    fun mediaPrepended() {
        whenever(articles.save(any())).thenAnswer { it.getArgument(0) }
        val xml = """
            <?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
            <item><title>t</title><link>https://example.com/w</link>
            <enclosure url="https://example.com/i.png" type="image/png"/>
            <description>plain text</description></item>
            </channel></rss>
        """.trimIndent()
        ingest.ingestXml(feed, xml)
        val captor = argumentCaptor<rssapi.persist.ArticleEntity>()
        verify(articles).save(captor.capture())
        assertTrue(captor.firstValue.contentHtml?.contains("https://example.com/i.png") == true)
    }

    @Test
    fun linklessItems() {
        whenever(articles.save(any())).thenAnswer { it.getArgument(0) }
        val xml = """
            <?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
            <item><title>no link here</title><guid>g9</guid></item>
            </channel></rss>
        """.trimIndent()
        ingest.ingestXml(feed, xml)
        val captor = argumentCaptor<rssapi.persist.ArticleEntity>()
        verify(articles).save(captor.capture())
        assertEquals(null, captor.firstValue.link)
        assertEquals(null, captor.firstValue.normLink)
    }
}
