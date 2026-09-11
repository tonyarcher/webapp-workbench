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
}
