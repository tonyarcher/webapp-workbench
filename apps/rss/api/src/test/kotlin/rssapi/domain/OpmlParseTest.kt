package rssapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class OpmlParseTest {
    @Test
    fun parsesOutline() {
        val xml = """
            <opml version="2.0"><body>
              <outline text="News">
                <outline type="rss" text="A" xmlUrl="https://a.example/rss"/>
              </outline>
            </body></opml>
        """.trimIndent()
        val nodes = parseOpml(xml)
        assertEquals(1, nodes.size)
        assertTrue(nodes[0] is OpmlFolder)
        val folder = nodes[0] as OpmlFolder
        assertEquals("News", folder.title)
        assertEquals("https://a.example/rss", (folder.children[0] as OpmlSource).xmlUrl)
    }

    @Test
    fun folderWithOwnFeedKeepsChildren() {
        val xml = """
            <opml version="2.0"><body>
              <outline text="News" xmlUrl="https://parent.example/rss">
                <outline type="rss" text="A" xmlUrl="https://a.example/rss"/>
              </outline>
            </body></opml>
        """.trimIndent()
        val nodes = parseOpml(xml)
        assertEquals(1, nodes.size)
        assertTrue(nodes[0] is OpmlFolder)
        val folder = nodes[0] as OpmlFolder
        assertEquals(2, folder.children.size)
        assertEquals("https://parent.example/rss", (folder.children[0] as OpmlSource).xmlUrl)
        assertEquals("https://a.example/rss", (folder.children[1] as OpmlSource).xmlUrl)
    }

    @Test
    fun titleAttrBeatsText() {
        val xml = """<opml version="2.0"><body>""" +
            """<outline title="T" text="X" xmlUrl="https://a.example/rss"/></body></opml>"""
        val nodes = parseOpml(xml)
        assertEquals("T", (nodes[0] as OpmlSource).title)
        assertEquals(null, (nodes[0] as OpmlSource).htmlUrl)
    }

    @Test
    fun htmlUrlKept() {
        val xml = """<opml version="2.0"><body>""" +
            """<outline text="A" xmlUrl="https://a.example/rss" htmlUrl="https://a.example/"/>""" +
            """</body></opml>"""
        val source = parseOpml(xml)[0] as OpmlSource
        assertEquals("https://a.example/", source.htmlUrl)
    }

    @Test
    fun noBodyFallsBack() {
        val xml = """<opml version="2.0"><outline text="A" xmlUrl="https://a.example/rss"/></opml>"""
        assertEquals(1, parseOpml(xml).size)
    }

    @Test
    fun escXmlAll() {
        assertEquals("&amp;&lt;&gt;&quot;", escXml("&<>\""))
        assertEquals("plain", escXml("plain"))
    }
}
