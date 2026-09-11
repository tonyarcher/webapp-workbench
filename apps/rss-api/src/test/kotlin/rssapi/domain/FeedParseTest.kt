package rssapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class FeedParseTest {
    @Test
    fun parsesRssItem() {
        val xml = """
            <rss version="2.0"><channel>
              <title>News</title>
              <link>https://example.com/</link>
              <item>
                <title>Hello</title>
                <link>https://example.com/a</link>
                <guid>g1</guid>
                <pubDate>Thu, 01 Jan 2026 00:00:00 GMT</pubDate>
                <description>hi</description>
              </item>
            </channel></rss>
        """.trimIndent()
        val feed = parseFeedXml(xml, 0L)
        assertEquals("News", feed.title)
        assertEquals(1, feed.items.size)
        assertEquals("Hello", feed.items[0].title)
        assertEquals("g1", feed.items[0].guid)
    }

    @Test
    fun rejectsHtml() {
        assertFailsWith<IllegalArgumentException> {
            parseFeedXml("<html><body>nope</body></html>", 0L)
        }
    }
}
