package rssapi.scrape
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import rssapi.fetch.FeedFetcher
import rssapi.fetch.FetchResult
import rssapi.fetch.PageFetcher
import rssapi.platform.ApiException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

private const val SITE = "https://example.com/"
private const val SITE_HTML = """
    <html><head><title>Site</title></head><body>
      <link rel="alternate" type="application/rss+xml" title="Main feed" href="/feed.xml">
    </body></html>
"""
private const val FEED_XML = """
    <rss version="2.0"><channel><title>Feed title</title>
      <item><title>One</title><link>https://example.com/one</link><pubDate>Thu, 19 Nov 2026 00:00:00 GMT</pubDate></item>
    </channel></rss>
"""

class FeedDiscoveryServiceTest {
    private val pages: PageFetcher = mock()
    private val feeds: FeedFetcher = mock()
    private val service = FeedDiscoveryService(pages, feeds)

    private fun statusOf(block: () -> Unit): Int = assertFailsWith<ApiException>(block = block).status.value()

    @Test
    fun discoversAndPreviewsAFeed() {
        whenever(pages.fetchHtml(SITE)).thenReturn(SITE_HTML)
        doReturn(FetchResult(200, text = FEED_XML)).whenever(feeds).fetch(any(), anyOrNull(), anyOrNull())

        val result = service.discover(SITE)

        assertEquals("Site", result.siteTitle)
        assertEquals("Feed title", result.feeds.first().title)
        assertEquals(listOf("One"), result.feeds.first().recentTitles)
        assertTrue(result.feeds.first().lastPublished!! > 0)
    }

    @Test
    fun keepsTheCandidateWhenPeekFails() {
        whenever(pages.fetchHtml(SITE)).thenReturn(SITE_HTML)
        doThrow(IllegalStateException("down")).whenever(feeds).fetch(any(), anyOrNull(), anyOrNull())

        val result = service.discover(SITE)

        assertEquals("Main feed", result.feeds.first().title)
        assertTrue(result.feeds.first().recentTitles.isEmpty())
        assertEquals(null, result.feeds.first().lastPublished)
    }

    @Test
    fun previewsAFeedWithNoItems() {
        whenever(pages.fetchHtml(SITE)).thenReturn(SITE_HTML)
        doReturn(FetchResult(200, text = """<rss version="2.0"><channel><title></title></channel></rss>"""))
            .whenever(feeds).fetch(any(), anyOrNull(), anyOrNull())

        val feed = service.discover(SITE).feeds.first()

        assertEquals("Untitled feed", feed.title)
        assertTrue(feed.recentTitles.isEmpty())
        assertEquals(null, feed.lastPublished)
    }

    @Test
    fun keepsCandidateWhenFeedHasNoBody() {
        whenever(pages.fetchHtml(SITE)).thenReturn(SITE_HTML)
        doReturn(FetchResult(304)).whenever(feeds).fetch(any(), anyOrNull(), anyOrNull())

        val feed = service.discover(SITE).feeds.first()

        assertEquals("Main feed", feed.title)
        assertTrue(feed.recentTitles.isEmpty())
    }

    @Test
    fun reportsASiteWithNoFeeds() {
        whenever(pages.fetchHtml(SITE)).thenReturn("<p>none</p>")
        assertEquals(422, statusOf { service.discover(SITE) })
    }

    @Test
    fun rejectsInvalidUrl() {
        assertEquals(400, statusOf { service.discover("javascript:alert(1)") })
        assertEquals(400, statusOf { service.discover(null) })
    }

    @Test
    fun reportsFetchFailure() {
        whenever(pages.fetchHtml(SITE)).thenThrow(IllegalStateException("down"))
        assertEquals(400, statusOf { service.discover(SITE) })
    }
}
