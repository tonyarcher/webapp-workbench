package rssapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class FeedMediaBranchTest {
    @Test
    fun commentCounts() {
        assertEquals(3, parseFeedXml(rssWith("<comments>3</comments>"), 0L).items[0].comments)
        assertNull(parseFeedXml(rssWith("<comments>abc</comments>"), 0L).items[0].comments)
        assertNull(parseFeedXml(rssWith("<comments>-2</comments>"), 0L).items[0].comments)
        assertNull(parseFeedXml(rssWith("<title>t</title>"), 0L).items[0].comments)
    }

    @Test
    fun enclosureImage() {
        val feed = parseFeedXml(rssWith("<enclosure url=\"https://example.com/i.png\" type=\"image/png\"/>"), 0L)
        assertEquals("https://example.com/i.png", feed.items[0].media)
    }

    @Test
    fun enclosureNonImageFallsThrough() {
        val xml = """
            <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>
              <title>N</title><link>https://example.com/</link>
              <item><title>t</title><link>https://example.com/a</link><guid>g1</guid>
                <enclosure url="https://example.com/a.mp3" type="audio/mpeg"/>
                <media:thumbnail url="https://example.com/t.png"/>
              </item>
            </channel></rss>
        """.trimIndent()
        val feed = parseFeedXml(xml, 0L)
        assertEquals("https://example.com/t.png", feed.items[0].media)
    }

    @Test
    fun mediaContentImage() {
        val xml = """
            <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>
              <title>N</title><link>https://example.com/</link>
              <item><title>t</title><link>https://example.com/a</link><guid>g1</guid>
                <media:content url="https://example.com/m.png" medium="image"/>
              </item>
            </channel></rss>
        """.trimIndent()
        assertEquals("https://example.com/m.png", parseFeedXml(xml, 0L).items[0].media)
    }

    @Test
    fun mediaContentMissingTypeAssumedImage() {
        val xml = """
            <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>
              <title>N</title><link>https://example.com/</link>
              <item><title>t</title><link>https://example.com/a</link><guid>g1</guid>
                <media:content url="https://example.com/v.mp4" medium="video"/>
              </item>
            </channel></rss>
        """.trimIndent()
        assertEquals("https://example.com/v.mp4", parseFeedXml(xml, 0L).items[0].media)
    }

    @Test
    fun mediaContentVideoAudioSkipped() {
        val xml = """
            <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>
              <title>N</title><link>https://example.com/</link>
              <item><title>t</title><link>https://example.com/a</link><guid>g1</guid>
                <media:content url="https://example.com/v.mp4" medium="video" type="audio/mpeg"/>
              </item>
            </channel></rss>
        """.trimIndent()
        assertNull(parseFeedXml(xml, 0L).items[0].media)
    }

    @Test
    fun mediaContentEmptyUrlSkipped() {
        val xml = """
            <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>
              <title>N</title><link>https://example.com/</link>
              <item><title>t</title><link>https://example.com/a</link><guid>g1</guid>
                <media:content url="" medium="image"/>
              </item>
            </channel></rss>
        """.trimIndent()
        assertNull(parseFeedXml(xml, 0L).items[0].media)
    }

    @Test
    fun atomEnclosureLink() {
        val xml = """
            <feed xmlns="http://www.w3.org/2005/Atom">
              <title>N</title>
              <entry><title>t</title>
                <link href="https://example.com/e.png" rel="enclosure" type="image/png"/>
              </entry>
            </feed>
        """.trimIndent()
        assertEquals("https://example.com/e.png", parseFeedXml(xml, 0L).items[0].media)
    }

    @Test
    fun atomEnclosureAudioSkipped() {
        val xml = """
            <feed xmlns="http://www.w3.org/2005/Atom">
              <title>N</title>
              <entry><title>t</title>
                <link href="https://example.com/e.mp3" rel="enclosure" type="audio/mpeg"/>
              </entry>
            </feed>
        """.trimIndent()
        assertNull(parseFeedXml(xml, 0L).items[0].media)
    }

    @Test
    fun atomEnclosureBadHrefSkipped() {
        val xml = """
            <feed xmlns="http://www.w3.org/2005/Atom">
              <title>N</title>
              <entry><title>t</title>
                <link href="javascript:alert(1)" rel="enclosure" type="image/png"/>
              </entry>
            </feed>
        """.trimIndent()
        assertNull(parseFeedXml(xml, 0L).items[0].media)
    }

    @Test
    fun atomMultiLinkAlternateWins() {
        val xml = """
            <feed xmlns="http://www.w3.org/2005/Atom">
              <title>N</title>
              <link href="https://example.com/first"/>
              <link href="https://example.com/alt" rel="alternate"/>
              <entry><title>t</title>
                <link href="https://example.com/1"/>
                <link href="https://example.com/2" rel="alternate"/>
                <link href="https://example.com/3"/>
              </entry>
            </feed>
        """.trimIndent()
        val feed = parseFeedXml(xml, 0L)
        assertEquals("https://example.com/2", feed.siteUrl)
        assertEquals("https://example.com/2", feed.items[0].link)
    }

    @Test
    fun atomBareEntry() {
        val xml = """
            <feed xmlns="http://www.w3.org/2005/Atom">
              <title>FeedTitle</title>
              <entry></entry>
            </feed>
        """.trimIndent()
        val feed = parseFeedXml(xml, 99L)
        assertEquals("(untitled)", feed.items[0].title)
        assertEquals("99-FeedTitle", feed.items[0].guid)
        assertEquals(99L, feed.items[0].published)
    }

    @Test
    fun atomNonEnclosureNoMedia() {
        val xml = """
            <feed xmlns="http://www.w3.org/2005/Atom">
              <title>N</title>
              <entry><title>t</title>
                <link href="https://example.com/a" rel="alternate"/>
              </entry>
            </feed>
        """.trimIndent()
        assertNull(parseFeedXml(xml, 0L).items[0].media)
    }

    @Test
    fun commentVariants() {
        assertEquals(5, parseFeedXml(rssWith("<total>5</total>"), 0L).items[0].comments)
        assertEquals(7, parseFeedXml(rssWith("<comment_count>7</comment_count>"), 0L).items[0].comments)
    }

    @Test
    fun emptyThumbnailSkipped() {
        val xml = """
            <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>
              <title>N</title><link>https://example.com/</link>
              <item><title>t</title><link>https://example.com/a</link><guid>g1</guid>
                <media:thumbnail url=""/>
                <media:thumbnail url="https://example.com/t.png"/>
              </item>
            </channel></rss>
        """.trimIndent()
        assertEquals("https://example.com/t.png", parseFeedXml(xml, 0L).items[0].media)
    }

    @Test
    fun emptyEnclosureSkipped() {
        val xml = """
            <rss version="2.0"><channel>
              <title>N</title><link>https://example.com/</link>
              <item><title>t</title><link>https://example.com/a</link><guid>g1</guid>
                <enclosure url="" type="image/png"/>
              </item>
            </channel></rss>
        """.trimIndent()
        assertNull(parseFeedXml(xml, 0L).items[0].media)
    }

    private fun rssWith(inner: String): String = """
        <rss version="2.0"><channel>
          <title>N</title><link>https://example.com/</link>
          <item><title>t</title><link>https://example.com/a</link><guid>g1</guid>$inner</item>
        </channel></rss>
    """.trimIndent()
}
