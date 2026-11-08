package rssapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
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

    @Test
    fun channelIconRss() {
        val xml = """
            <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>
              <title>N</title><link>https://example.com/</link>
              <image><url>https://example.com/logo.png</url></image>
              <itunes:image href="https://example.com/itunes.png"/>
              <item><title>t</title><link>https://example.com/a</link><guid>g1</guid></item>
            </channel></rss>
        """.trimIndent()
        val feed = parseFeedXml(xml, 0L)
        assertEquals("https://example.com/logo.png", feed.icon)
    }

    @Test
    fun atomIcon() {
        val xml = """
            <feed xmlns="http://www.w3.org/2005/Atom">
              <title>N</title><logo>https://example.com/logo.png</logo>
              <entry><title>t</title><link href="https://example.com/a"/></entry>
            </feed>
        """.trimIndent()
        assertEquals("https://example.com/logo.png", parseFeedXml(xml, 0L).icon)
    }

    @Test
    fun channelIconItunesOnly() {
        val xml = """
            <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>
              <title>N</title><link>https://example.com/</link>
              <itunes:image href="https://example.com/itunes.png"/>
              <item><title>t</title><link>https://example.com/a</link><guid>g1</guid></item>
            </channel></rss>
        """.trimIndent()
        assertEquals("https://example.com/itunes.png", parseFeedXml(xml, 0L).icon)
    }

    @Test
    fun channelIconNone() {
        val xml = """
            <rss version="2.0"><channel>
              <title>N</title><link>https://example.com/</link>
              <item><title>t</title><link>https://example.com/a</link><guid>g1</guid></item>
            </channel></rss>
        """.trimIndent()
        assertNull(parseFeedXml(xml, 0L).icon)
    }

    @Test
    fun channelIconImageHref() {
        val xml = """
            <rss version="2.0"><channel>
              <title>N</title><link>https://example.com/</link>
              <image href="https://example.com/h.png"/>
              <item><title>t</title><link>https://example.com/a</link><guid>g1</guid></item>
            </channel></rss>
        """.trimIndent()
        assertEquals("https://example.com/h.png", parseFeedXml(xml, 0L).icon)
    }

    @Test
    fun channelIconItunesOnlyFallback() {
        // already covered; ensure null path
        val xml = """
            <rss version="2.0"><channel>
              <title>N</title><link>https://example.com/</link>
              <item><title>t</title><link>https://example.com/a</link><guid>g1</guid></item>
            </channel></rss>
        """.trimIndent()
        assertNull(parseFeedXml(xml, 0L).icon)
    }

    private fun untitledItem(): String = """<rss version="2.0"><channel><title>N</title>""" +
        """<item><link>https://example.com/a</link></item></channel></rss>"""
}
