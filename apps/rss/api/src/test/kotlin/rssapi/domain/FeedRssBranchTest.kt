package rssapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class FeedRssBranchTest {
    @Test
    fun dcDateAndCreator() {
        val xml = """
            <rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
            <channel><title>N</title><link>https://example.com/</link>
              <item>
                <title>t</title><link>https://example.com/a</link><guid>g1</guid>
                <dc:date>2026-01-01T00:00:00Z</dc:date>
                <dc:creator>Ada</dc:creator>
                <content:encoded><![CDATA[<p>full</p>]]></content:encoded>
              </item>
            </channel></rss>
        """.trimIndent()
        val feed = parseFeedXml(xml, 0L)
        assertEquals("Ada", feed.items[0].author)
        assertEquals("<p>full</p>", feed.items[0].content)
    }

    @Test
    fun plainAuthor() {
        val xml = """
            <rss version="2.0"><channel><title>N</title><link>https://example.com/</link>
              <item><title>t</title><link>https://example.com/a</link><guid>g1</guid>
                <author>bob@example.com</author>
              </item>
            </channel></rss>
        """.trimIndent()
        assertEquals("bob@example.com", parseFeedXml(xml, 0L).items[0].author)
    }

    @Test
    fun pubFormatsAndFallbacks() {
        assertEquals(99L, tryParsePub(null, 99L))
        assertEquals(99L, tryParsePub("   ", 99L))
        assertEquals(99L, tryParsePub("not a date", 99L))
        val iso = tryParsePub("2026-01-01T00:00:00Z", 0L)
        assertTrue(iso > 0)
        val rfc = tryParsePub("Thu, 01 Jan 2026 00:00:00 GMT", 0L)
        assertTrue(rfc > 0)
    }

    @Test
    fun missingChannelFallsBack() {
        val xml = """<rss version="2.0"><title>Top</title><item><title>i</title></item></rss>"""
        val feed = parseFeedXml(xml, 7L)
        assertEquals("Top", feed.title)
        assertEquals(7L, feed.items[0].published)
        assertEquals("(untitled)", parseFeedXml(untitledItem(), 0L).items[0].title)
    }

    private fun untitledItem(): String = """<rss version="2.0"><channel><title>N</title>""" +
        """<item><link>https://example.com/a</link></item></channel></rss>"""
}
