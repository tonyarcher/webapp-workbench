package rssapi.domain

import org.jsoup.Jsoup
import kotlin.test.Test
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ArticleExtractFinalBranchesTest {
    @Test
    fun usableHtmlRejectsShortText() {
        val html = """<html><body><article><p>short text only</p></article></body></html>"""
        assertNull(extractArticleHtml(html, "https://e.com/a"))
    }

    @Test
    fun setAbsSkipsBlank() {
        val text = ("A long enough paragraph for extraction with details and commas. ").repeat(8)
        val html = """<html><body><article><p>$text</p><a href="javascript:void(0)">x</a></article></body></html>"""
        val out = extractArticleHtml(html, "https://e.com/a")
        assertNotNull(out)
    }

    @Test
    fun bestCandidatePicksHigherScore() {
        val low = ("words ").repeat(30)
        val high = ("Detailed article text, with commas and real substance in paragraphs. ").repeat(10)
        val html = """
            <html><body>
              <div><p>$low</p></div>
              <div class="article content"><p>$high</p><p>$high</p></div>
            </body></html>
        """.trimIndent()
        val out = extractArticleHtml(html, "https://e.com/a")
        assertNotNull(out)
        assertTrue(out.contains("Detailed article text"))
    }

    @Test
    fun linkHeavyContentLowersDensity() {
        val text = ("text ").repeat(20)
        val html = """
            <html><body>
              <div class="content"><p>$text</p><a href="/a">link link link link link link</a><a href="/b">link link link link link link</a></div>
              <article><p>${"Good content with commas and detail. ".repeat(10)}</p></article>
            </body></html>
        """.trimIndent()
        val out = extractArticleHtml(html, "https://e.com/a")
        assertNotNull(out)
    }
}
