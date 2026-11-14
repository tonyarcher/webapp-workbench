package rssapi.domain

import org.jsoup.Jsoup
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ArticleExtractBranchesTest {
    @Test
    fun unknownJsonEscapeHandled() {
        val body = ("Before \\q after with enough words to form a real article body. ").repeat(6)
        val html = """<script type="application/ld+json">{"articleBody":"$body"}</script>"""
        val out = jsonLdArticleBody(Jsoup.parse("<html><head>$html</head><body></body></html>", "https://e.com/a"))
        assertNotNull(out)
        assertTrue(out.contains("after"))
    }

    @Test
    fun jsonStringStartWhitespaceAndEdgeCases() {
        val good = ("Enough article body text for extraction to accept it as content. ").repeat(6)
        val html = """<script type="application/ld+json">{ "articleBody" : "$good" }</script>"""
        val out = jsonLdArticleBody(Jsoup.parse("<html><head>$html</head><body></body></html>", "https://e.com/a"))
        assertNotNull(out)
        val noQuote = """{"articleBody":   }"""
        assertNull(
            jsonLdArticleBody(
                Jsoup.parse(
                    "<html><head><script type=application/ld+json>$noQuote</script></head></html>",
                    "https://e.com",
                ),
            ),
        )
    }

    @Test
    fun articleBodyHtmlRejectsShortOrEmpty() {
        val short = """{"articleBody":"too short"}"""
        assertNull(
            jsonLdArticleBody(
                Jsoup.parse(
                    "<html><head><script type=application/ld+json>$short</script></head></html>",
                    "https://e.com",
                ),
            ),
        )
        val blank = """{"articleBody":"   "}"""
        assertNull(
            jsonLdArticleBody(
                Jsoup.parse(
                    "<html><head><script type=application/ld+json>$blank</script></head></html>",
                    "https://e.com",
                ),
            ),
        )
    }

    @Test
    fun usableHtmlNeedsTextAndHtml() {
        val html = """<html><body><article><img src="x"></article></body></html>"""
        assertNull(extractArticleHtml(html, "https://e.com/a"))
    }

    @Test
    fun absUrlBlankNotSet() {
        val text = ("Paragraph text long enough to be extracted as the main article body. ").repeat(8)
        val html = """<html><body><article><p>$text</p><a name="anchor">x</a></article></body></html>"""
        val out = extractArticleHtml(html, "https://e.com/a")
        assertNotNull(out)
    }

    @Test
    fun negativeHintLowersScoreButContentCanWin() {
        val good = ("Strong content paragraph with analysis, commas, and useful detail. ").repeat(12)
        val bad = ("nav links ").repeat(80)
        val html = """
            <html><body>
              <div class="hidden sidebar promo">$bad<a href="/x">x</a><a href="/y">y</a></div>
              <article class="post"><p>$good</p></article>
            </body></html>
        """.trimIndent()
        val out = extractArticleHtml(html, "https://e.com/a")
        assertNotNull(out)
        assertTrue(out.contains("Strong content paragraph"))
    }

    @Test
    fun bestCandidateTiesAndNulls() {
        val text = ("A reasonably long paragraph for article extraction with commas and words. ").repeat(8)
        val html = """<html><body><article><p>$text</p></article></body></html>"""
        assertNotNull(extractArticleHtml(html, "https://e.com/a"))
        assertNull(extractArticleHtml("<html><body><div></div></body></html>", "https://e.com/a"))
    }

    @Test
    fun pruneSkipsEmptyHintAndKeepsMaybe() {
        val body = ("Story content that should survive even if inside a header-story container. ").repeat(12)
        val html =
            """<html><body><div class="header-story">$body</div>""" +
                """<div class="banner-ad">$body</div></body></html>"""
        val out = extractArticleHtml(html, "https://e.com/a")
        assertNotNull(out)
    }
}
