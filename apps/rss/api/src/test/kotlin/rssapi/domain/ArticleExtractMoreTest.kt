package rssapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ArticleExtractMoreTest {
    @Test
    fun blankInputsReturnNull() {
        assertNull(extractArticleHtml("", "https://e.com/x"))
        assertNull(extractArticleHtml("   ", "https://e.com/x"))
        assertNull(ampUrlOf("", "https://e.com/x"))
        assertNull(canonicalUrlOf("", "https://e.com/x"))
    }

    @Test
    fun canonicalMissingReturnsNull() {
        assertNull(canonicalUrlOf("<html><head></head></html>", "https://e.com/x"))
    }

    @Test
    fun jsonLdUnicodeEscapesAndNoParagraphSplit() {
        val body = "A café story about storage costs and grids and developers. ".repeat(6)
        val jsonBody = body.replace("café", "caf\\u00e9")
        val html = """
            <html><head>
            <script type="application/ld+json">{"@type":"NewsArticle","articleBody":"$jsonBody"}</script>
            </head><body></body></html>
        """.trimIndent()
        val out = extractArticleHtml(html, "https://e.com/a")
        assertNotNull(out)
        assertTrue(out.contains("café"))
        assertTrue(out.contains("<p>"))
    }

    @Test
    fun jsonLdParagraphsAndEscapes() {
        val p1 = "First paragraph with enough detail about batteries and grid storage economics. ".repeat(2)
        val p2 = "Second paragraph continues with developers and projects and costs and plans. ".repeat(2)
        val jsonBody = (p1.trim() + "\\n\\n" + p2.trim()).replace("\"", "\\\"")
        val html = """<script type="application/ld+json">{"articleBody":"$jsonBody"}</script>"""
        val doc = org.jsoup.Jsoup.parse("<html><head>$html</head><body></body></html>", "https://e.com/a")
        val out = jsonLdArticleBody(doc)
        assertNotNull(out)
        assertTrue(out.contains("<p>"))
        assertTrue(out.contains("Second paragraph"))
    }

    @Test
    fun jsonLdSkipsInvalidOrShortBodies() {
        val scripts = listOf(
            """<script type="application/ld+json">not json but has articleBody text</script>""",
            """<script type="application/ld+json">{"articleBody":123}</script>""",
            """<script type="application/ld+json">{"articleBody":"short"}</script>""",
            """<script type="application/ld+json">{"other":"x"}</script>""",
        )
        for (s in scripts) {
            val doc = org.jsoup.Jsoup.parse("<html><head>$s</head><body></body></html>", "https://e.com/a")
            assertNull(jsonLdArticleBody(doc))
        }
    }

    @Test
    fun fallsBackToBodyWhenNoGoodCandidate() {
        val text = (
            "Plain body text with enough words to count as an article. " +
                "It keeps going with more sentences and commas, details, and context. "
            ).repeat(6)
        val html = """<html><body><div>$text</div></body></html>"""
        val out = extractArticleHtml(html, "https://e.com/a")
        assertNotNull(out)
        assertTrue(out.contains("Plain body text"))
    }

    @Test
    fun returnsNullWhenBodyTooShort() {
        val html = """<html><body><div>tiny</div></body></html>"""
        assertNull(extractArticleHtml(html, "https://e.com/a"))
    }

    @Test
    fun stripsNoiseAndScoresMain() {
        val article = ("Main story content, with commas, details, and several paragraphs of substance. ").repeat(10)
        val html = """
            <html><body>
              <nav class="menu">nav links</nav>
              <div class="sidebar related">related stuff links links</div>
              <main role="main"><p>$article</p></main>
              <footer>footer</footer>
            </body></html>
        """.trimIndent()
        val out = extractArticleHtml(html, "https://e.com/a")
        assertNotNull(out)
        assertTrue(out.contains("Main story content"))
    }

    @Test
    fun absolutizesLinks() {
        val text = ("Absolutized content paragraph for extraction with enough length. ").repeat(8)
        val html =
            """<html><body><article><p>$text</p><a href="/path">x</a>""" +
                """<img src="/img.png"></article></body></html>"""
        val out = extractArticleHtml(html, "https://e.com/base/")
        assertNotNull(out)
        assertTrue(out.contains("https://e.com/path"))
        assertTrue(out.contains("https://e.com/img.png"))
    }
}
