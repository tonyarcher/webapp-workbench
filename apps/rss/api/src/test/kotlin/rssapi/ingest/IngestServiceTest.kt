package rssapi.ingest

import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import rssapi.fetch.FeedFetcher
import rssapi.persist.ArticleMaintenanceRepo
import rssapi.persist.ArticleRepo
import rssapi.persist.FeedEntity
import rssapi.persist.FeedRepo
import rssapi.persist.ArticleEntity

class IngestServiceTest {
    private val feeds: FeedRepo = mock()
    private val articles: ArticleRepo = mock()
    private val maintenance: ArticleMaintenanceRepo = mock()
    private val sync: IngestSync = mock()
    private val pending: PendingApply = mock()
    private val fetcher: FeedFetcher = mock()
    private val ingest = IngestService(feeds, articles, maintenance, sync, pending, fetcher)

    private val rss = """
        <?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
        <item><title>x</title><link>https://example.com/x</link></item>
        </channel></rss>
    """.trimIndent()

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
