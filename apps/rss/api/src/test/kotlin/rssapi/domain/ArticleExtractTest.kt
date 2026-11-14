package rssapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ArticleExtractTest {
    @Test
    fun extractsAmpUrl() {
        val html = """<html><head><link rel="amphtml" href="/amp/story"></head><body>x</body></html>"""
        assertEquals("https://example.com/amp/story", ampUrlOf(html, "https://example.com/news/story"))
    }

    @Test
    fun ampUrlMissingReturnsNull() {
        assertNull(ampUrlOf("<html><head></head></html>", "https://example.com/x"))
    }

    @Test
    fun extractsJsonLdArticleBody() {
        val body = "Battery storage costs fell again this quarter according to analysts. ".repeat(8)
        val html = """
            <html><head>
            <script type="application/ld+json">{"@type":"NewsArticle","articleBody":"$body"}</script>
            </head><body><nav>menu</nav><p>short</p></body></html>
        """.trimIndent()
        val out = extractArticleHtml(html, "https://example.com/a")
        assertNotNull(out)
        assertTrue(out.contains("Battery storage costs"))
        assertTrue(out.contains("<p>"))
    }

    @Test
    fun prefersArticleContainerOverBoilerplate() {
        val text = (
            "Grid operators say the decline is making long duration storage economical. " +
                "Developers are reworking projects that were shelved as too expensive. "
            ).repeat(6)
        val html = """
            <html><body>
              <header><nav>Home About Subscribe</nav></header>
              <div class="sidebar related promo"><a href="/x">link</a> <a href="/y">link</a></div>
              <article class="post-content"><h1>Title</h1><p>$text</p><p>$text</p></article>
              <footer>copyright links links links</footer>
            </body></html>
        """.trimIndent()
        val out = extractArticleHtml(html, "https://example.com/story")
        assertNotNull(out)
        assertTrue(out.contains("Grid operators"))
        assertTrue(!out.contains("Subscribe"))
    }

    @Test
    fun returnsNullWhenTooLittleText() {
        val html = """<html><body><article><p>Too short.</p></article></body></html>"""
        assertNull(extractArticleHtml(html, "https://example.com/x"))
    }

    @Test
    fun canonicalUrlExtracted() {
        val html = """<html><head><link rel="canonical" href="https://example.com/canon"></head></html>"""
        assertEquals("https://example.com/canon", canonicalUrlOf(html, "https://example.com/other"))
    }
}
