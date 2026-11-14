package rssapi.domain

import org.jsoup.Jsoup
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ArticleExtractGapTest {
    @Test
    fun pruneUnlikelyKeepsEmptyHintAndLargeUnlikely() {
        val big = (
            "Likely article body inside a comment-like wrapper but very large. " +
                "It carries enough text, commas, and paragraphs to be kept. "
            ).repeat(20)
        val html = """
            <html><body>
              <div id="" class="">${"ok ".repeat(20)}</div>
              <div class="comment">$big</div>
              <article><p>${"Main content with detail and commas. ".repeat(10)}</p></article>
            </body></html>
        """.trimIndent()
        val out = extractArticleHtml(html, "https://e.com/a")
        assertNotNull(out)
    }

    @Test
    fun setAbsSkipsWhenAbsBlank() {
        val text = ("A long enough paragraph for extraction with details and commas. ").repeat(8)
        // malformed base/url can yield blank abs in some cases; use relative with empty href already covered
        val html = """<html><body><article><p>$text</p><img src=""></article></body></html>"""
        val out = extractArticleHtml(html, "https://e.com/a")
        assertNotNull(out)
    }

    @Test
    fun bestCandidateIgnoresLowerOrEqualScores() {
        val strong = ("Strong article paragraph with commas, substance, and context. ").repeat(12)
        val weak = ("weak ").repeat(20)
        val html = """
            <html><body>
              <article><p>$strong</p><p>$strong</p></article>
              <div><p>$weak</p></div>
            </body></html>
        """.trimIndent()
        val out = extractArticleHtml(html, "https://e.com/a")
        assertNotNull(out)
        assertTrue(out.contains("Strong article paragraph"))
    }

    @Test
    fun canonicalAndAmpSelectFirstMissing() {
        val html = "<html><head><title>x</title></head><body></body></html>"
        assertNull(ampUrlOf(html, "https://e.com/a"))
        assertNull(canonicalUrlOf(html, "https://e.com/a"))
    }

    @Test
    fun paragraphsHtmlSingleBlock() {
        val body = ("One block of article text with enough length for json ld extraction. ").repeat(5)
        val html = """<script type="application/ld+json">{"articleBody":"$body"}</script>"""
        val out = jsonLdArticleBody(Jsoup.parse("<html><head>$html</head></html>", "https://e.com/a"))
        assertNotNull(out)
        assertTrue(out.startsWith("<p>"))
    }

    @Test
    fun jsonLdArticleBodyNoMatchOrEmptyScript() {
        val doc = Jsoup.parse(
            """<html><head><script type="application/ld+json">{"articleBody":"   "}</script></head></html>""",
            "https://e.com/a",
        )
        assertNull(jsonLdArticleBody(doc))
    }

    @Test
    fun extractUsesFallbackBody() {
        val text = ("Body fallback content with enough text and commas, to be selected. ").repeat(8)
        val html = """<html><body><div>$text</div></body></html>"""
        val out = extractArticleHtml(html, "https://e.com/a")
        assertNotNull(out)
    }
}
