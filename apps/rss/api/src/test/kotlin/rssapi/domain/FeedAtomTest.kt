package rssapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class FeedAtomTest {
    private fun atomFeed(vararg entries: String): String =
        """<feed xmlns="http://www.w3.org/2005/Atom">""" + entries.joinToString("") + """</feed>"""

    @Test
    fun parsesAtomEntries() {
        val xml = atomFeed(
            """<title>Atom News</title><link href="https://example.com/" rel="alternate"/>""",
            atomEntry("e1", "First", "2026-01-01T00:00:00Z"),
            """<entry><title>(no id)</title><updated>2026-01-02T00:00:00Z</updated></entry>""",
        )
        val feed = parseFeedXml(xml, 99L)
        assertEquals("Atom News", feed.title)
        assertEquals(2, feed.items.size)
        assertEquals("e1", feed.items[0].guid)
        assertEquals("First", feed.items[0].title)
        assertTrue(feed.items[1].published != 0L)
    }

    private fun atomEntry(id: String, title: String, published: String): String =
        """<entry><id>$id</id><title>$title</title>""" +
            """<link href="https://example.com/1" rel="alternate"/>""" +
            """<published>$published</published><summary>short</summary>""" +
            """<content>full body</content></entry>"""

    @Test
    fun atomFallbacks() {
        val xml = """
            <feed xmlns="http://www.w3.org/2005/Atom">
              <entry><id>e1</id></entry>
            </feed>
        """.trimIndent()
        val feed = parseFeedXml(xml, 42L)
        assertEquals("Untitled feed", feed.title)
        assertEquals(1, feed.items.size)
        assertEquals(42L, feed.items[0].published)
    }
}
