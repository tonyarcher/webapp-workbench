package rssapi.ingest

import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.clearInvocations
import org.mockito.kotlin.mock
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import rssapi.domain.makeArticleId
import rssapi.fetch.FeedFetcher
import rssapi.fetch.PageFetcher
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleMaintenanceRepo
import rssapi.persist.ArticleRepo
import rssapi.persist.FeedEntity
import rssapi.persist.FeedRepo
import rssapi.scrape.SemanticListExtractor
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

private const val PAGE_URL = "https://example.com/blog"
private const val PAGE_HTML = """
    <article><h2><a href="/one">One</a></h2><p>first</p></article>
    <article><h2><a href="/two">Two</a></h2><p>second</p></article>
"""

private fun rssItem(guid: String) = """
    <item><title>x</title><link>https://example.com/x</link>
      <guid>""" + guid + """</guid>
      <pubDate>Thu, 19 Nov 2026 00:00:00 GMT</pubDate><description>hi</description>
    </item>
""".trimIndent()

private fun rssWith(item: String) = """<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>""" +
    item + """</channel></rss>"""

class IngestServiceTest {
    private val feeds: FeedRepo = mock()
    private val articles: ArticleRepo = mock()
    private val maintenance: ArticleMaintenanceRepo = mock()
    private val sync: IngestSync = mock()
    private val pending: PendingApply = mock()
    private val fetcher: FeedFetcher = mock()
    private val ingest = IngestService(feeds, articles, maintenance, sync, pending, fetcher, mock())

    private val rss = """
        <?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
        <item><title>x</title><link>https://example.com/x</link></item>
        </channel></rss>
    """.trimIndent()

    @Test
    fun unchangedArticleIsNotRewritten() {
        val feed = FeedEntity(id = UUID.randomUUID(), xmlUrl = "https://example.com/rss", title = "t")
        val guid = "g1"
        val item = rssItem(guid)
        val xml = rssWith(item)
        whenever(articles.save(any<ArticleEntity>())).thenAnswer { it.getArgument(0) }
        ingest.ingestXml(feed, xml)
        val stored = argumentCaptor<ArticleEntity>()
        verify(articles).save(stored.capture())
        org.mockito.kotlin.clearInvocations(articles, maintenance)
        whenever(articles.findByFeedIdAndGuid(feed.id!!, guid)).thenReturn(stored.firstValue)

        ingest.ingestXml(feed, xml)

        verify(articles, org.mockito.kotlin.never()).save(any())
        verify(maintenance, org.mockito.kotlin.never()).updatePopularity(any(), any())
    }

    @Test
    fun changedArticleIsSavedAgain() {
        val feed = FeedEntity(id = UUID.randomUUID(), xmlUrl = "https://example.com/rss", title = "t")
        val guid = "g1"
        val existing = ArticleEntity(
            id = makeArticleId(feed.id!!.toString(), guid),
            feedId = feed.id!!,
            guid = guid,
            title = "old",
        )
        whenever(articles.findByFeedIdAndGuid(feed.id!!, guid)).thenReturn(existing)
        whenever(articles.save(any<ArticleEntity>())).thenAnswer { it.getArgument(0) }

        ingest.ingestXml(feed, rssWith(rssItem(guid)))

        verify(articles).save(any())
    }

    @Test
    fun ingestsJsonFeedText() {
        val feed = FeedEntity(id = UUID.randomUUID(), xmlUrl = "https://example.com/feed.json", title = "t")
        val json = """
            {"version":"https://jsonfeed.org/version/1.1","title":"JSON","items":[
              {"id":"j1","url":"https://example.com/j1","title":"Story","content_text":"body"}
            ]}
        """.trimIndent()
        whenever(articles.save(any<ArticleEntity>())).thenAnswer { it.getArgument(0) }

        ingest.ingestXml(feed, json)

        val captor = argumentCaptor<ArticleEntity>()
        verify(articles).save(captor.capture())
        assertEquals("Story", captor.firstValue.title)
        verify(sync).maybeRename(feed, "JSON")
    }

    @Test
    fun jsoupAndExtractorWork() {
        val doc = org.jsoup.Jsoup.parse(PAGE_HTML, PAGE_URL)
        assertEquals(2, SemanticListExtractor().extract(doc, PAGE_URL).size)
    }

    @Test
    fun ingestsWatchedPageItems() {
        val feed = watchedFeed()
        whenever(articles.save(any<ArticleEntity>())).thenAnswer { it.getArgument(0) }
        ingest.ingestScrapedHtml(feed, PAGE_HTML)

        val captor = argumentCaptor<ArticleEntity>()
        verify(articles, times(2)).save(captor.capture())
        assertEquals("One", captor.allValues[0].title)
        assertEquals("https://example.com/one", captor.allValues[0].link)
        verify(sync).saveOk(feed.id!!, null, null)
        assertTrue(feed.lastScrapeAt != null)
    }

    @Test
    fun scrapeFetchFailureIsRecorded() {
        val feed = watchedFeed()
        val service = serviceWithPages(object : PageFetcher {
            override fun fetchHtml(url: String): String = throw IllegalStateException("down")
        })

        service.scrapeAndIngest(feed)

        verify(sync).saveError(feed.id!!, "down")
    }

    @Test
    fun scrapeWithNoListIsRecorded() {
        val feed = watchedFeed()
        val service = serviceWithPages(object : PageFetcher {
            override fun fetchHtml(url: String): String = "<p>nothing</p>"
        })

        service.scrapeAndIngest(feed)

        verify(sync).saveError(feed.id!!, "No article list found on this page")
    }

    @Test
    fun scrapeWithNoMatchesIsRecorded() {
        val feed = watchedFeed()
        feed.itemSelector = ".missing"

        ingest.ingestScrapedHtml(feed, PAGE_HTML)

        verify(sync).saveError(feed.id!!, "No articles found on page")
    }

    private fun serviceWithPages(pages: PageFetcher) = IngestService(
        feeds,
        articles,
        maintenance,
        sync,
        pending,
        fetcher,
        pages,
    )

    private fun watchedFeed() = FeedEntity(
        id = UUID.randomUUID(),
        xmlUrl = PAGE_URL,
        title = "Blog",
        sourceKind = "scrape",
        pageUrl = PAGE_URL,
    )

    @Test
    fun popularityRefreshStaysOnIngestedFeed() {
        val feedId = UUID.randomUUID()
        val feed = FeedEntity(id = feedId, xmlUrl = "https://example.com/rss", title = "t")
        whenever(articles.save(any<ArticleEntity>())).thenAnswer { it.getArgument(0) }

        ingest.ingestXml(feed, rss)

        val feedCaptor = argumentCaptor<UUID>()
        val linksCaptor = argumentCaptor<Array<String>>()
        verify(maintenance).updatePopularity(feedCaptor.capture(), linksCaptor.capture())
        assertEquals(feedId, feedCaptor.firstValue)
        assertTrue(linksCaptor.firstValue.isNotEmpty())
        verify(maintenance).updateLonelyHot(feedId)
    }
}
