package timesupapi.scrape
import org.jsoup.Jsoup
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

private const val SITE = "https://example.com/"
private const val SITE_HTML = """
    <html><body>
      <link rel="alternate" type="application/rss+xml" title="Main feed" href="/feed.xml">
      <link rel="alternate" type="application/atom+xml" href="/atom.xml">
      <a href="https://other.example/feed.json">JSON</a>
      <a href="/about">About</a>
      <a href="javascript:alert(1)">Bad</a>
    </body></html>
"""

class FeedDiscoveryTest {
    @Test
    fun findsAdvertisedAndLinkedFeeds() {
        val found = FeedDiscovery.candidates(Jsoup.parse(SITE_HTML, SITE), SITE)
        assertEquals(3, found.size)
        assertEquals("rss", found.first().type)
        assertEquals("Main feed", found.first().title)
        assertEquals("advertised", found.first().source)
        assertEquals("json", found.first { it.url.contains("feed.json") }.type)
    }

    @Test
    fun ignoresNonFeedAndUnsafeLinks() {
        val found = FeedDiscovery.candidates(Jsoup.parse(SITE_HTML, SITE), SITE)
        assertTrue(found.none { it.url.contains("about") })
        assertTrue(found.none { it.url.startsWith("javascript") })
        assertTrue(found.none { it.url == SITE })
    }

    @Test
    fun labelsPlainFeedLinksAsLinked() {
        val html = """<a href="/rss">RSS</a><a href="/feed">Feed</a>"""
        val found = FeedDiscovery.candidates(Jsoup.parse(html, SITE), SITE)
        assertEquals(2, found.size)
        assertTrue(found.all { it.source == "linked" })
    }

    @Test
    fun capsTheCandidateList() {
        val links = (1..12).joinToString("") { "<a href=\"/feed$it.xml\">Feed $it</a>" }
        assertEquals(8, FeedDiscovery.candidates(Jsoup.parse(links, SITE), SITE).size)
    }

    @Test
    fun emptyPageHasNoFeeds() {
        assertTrue(FeedDiscovery.candidates(Jsoup.parse("<p>none</p>", SITE), SITE).isEmpty())
    }
}
