package rssapi.domain

import org.jsoup.Jsoup
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ArticleExtractCoverageTest {
    @Test
    fun jsonStringHandlesEscapes() {
        val body = """Line1\nLine2\tTabbed\rReturn\bBack\fForm\/Slash\\Back \"Quote\" and end. """.repeat(6)
        val html = """<script type="application/ld+json">{"articleBody":"$body"}</script>"""
        val doc = Jsoup.parse("<html><head>$html</head><body></body></html>", "https://e.com/a")
        val out = jsonLdArticleBody(doc)
        assertNotNull(out)
        assertTrue(out.contains("Line1"))
        assertTrue(out.contains("Quote"))
        assertTrue(out.contains("Slash"))
    }

    @Test
    fun jsonStringStartInvalidCases() {
        val cases = listOf(
            """{"nope":"x"}""",
            """{"articleBody" "missing colon"}""",
            """{"articleBody": 123}""",
            """{"articleBody": }""",
        )
        for (json in cases) {
            val doc = Jsoup.parse(
                "<html><head><script type=\"application/ld+json\">$json</script></head><body></body></html>",
                "https://e.com/a",
            )
            assertNull(jsonLdArticleBody(doc))
        }
    }

    @Test
    fun jsonLdUnterminatedStringReturnsNull() {
        val json = """{"articleBody":"unterminated"""
        val doc = Jsoup.parse(
            "<html><head><script type=\"application/ld+json\">$json</script></head><body></body></html>",
            "https://e.com/a",
        )
        assertNull(jsonLdArticleBody(doc))
    }

    @Test
    fun extractPrefersLongerUsableCandidate() {
        val weak = ("short paragraph. ").repeat(20)
        val strong = (
            "Strong article body with commas, detail, and long paragraphs. " +
                "Readers learn about storage economics and grid operators. "
            ).repeat(8)
        val html = """
            <html><body>
              <div id="content" class="article body"><p>$strong</p><p>$strong</p></div>
              <div class="sidebar comment related"><p>$weak</p><a href="/a">a</a><a href="/b">b</a></div>
            </body></html>
        """.trimIndent()
        val out = extractArticleHtml(html, "https://e.com/a")
        assertNotNull(out)
        assertTrue(out.contains("Strong article body"))
    }

    @Test
    fun unlikelyButMaybeContentKeptWhenBig() {
        val text = (
            "This header-like story block is actually the article body content. " +
                "It has enough words, commas, and meaning to survive pruning. "
            ).repeat(10)
        val html = """<html><body><div class="header-story article-content">$text</div></body></html>"""
        val out = extractArticleHtml(html, "https://e.com/a")
        assertNotNull(out)
        assertTrue(out.contains("actually the article body"))
    }

    @Test
    fun picksArticleTagAndMainHints() {
        val text = ("Substance paragraph for a real story with analysis and context. ").repeat(10)
        val html = """
            <html><body>
              <article><p>$text</p><p>$text</p></article>
            </body></html>
        """.trimIndent()
        val out = extractArticleHtml(html, "https://e.com/a")
        assertNotNull(out)
        assertTrue(out.contains("Substance paragraph"))
    }

    @Test
    fun negativeHintAndHighLinkDensityScoreLow() {
        val text = ("Some words. ").repeat(40)
        val html = """
            <html><body>
              <div class="promo sidebar widget hidden">
                <p>$text</p>
                <a href="/1">one two three four</a>
                <a href="/2">one two three four</a>
                <a href="/3">one two three four</a>
              </div>
              <div class="post content"><p>$text</p><p>$text</p></div>
            </body></html>
        """.trimIndent()
        val out = extractArticleHtml(html, "https://e.com/a")
        assertNotNull(out)
    }

    @Test
    fun ampAndCanonicalBlankHrefHandled() {
        val ampBlank = ampUrlOf("""<html><head><link rel="amphtml" href=""></head></html>""", "https://e.com/a")
        val canonBlank =
            canonicalUrlOf("""<html><head><link rel="canonical" href=""></head></html>""", "https://e.com/a")
        assertTrue(ampBlank == null || ampBlank == "https://e.com/a")
        assertTrue(canonBlank == null || canonBlank == "https://e.com/a")
        assertEquals(
            "https://e.com/amp",
            ampUrlOf("""<html><head><link rel="amphtml" href="/amp"></head></html>""", "https://e.com/a"),
        )
    }
}
