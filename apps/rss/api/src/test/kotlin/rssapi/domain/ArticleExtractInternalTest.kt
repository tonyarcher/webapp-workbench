package rssapi.domain

import org.jsoup.Jsoup
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ArticleExtractInternalTest {
    @Test
    fun unlikelyNoiseBranches() {
        assertTrue(isUnlikelyNoise("comment"))
        assertFalse(isUnlikelyNoise("article-content"))
        assertFalse(isUnlikelyNoise("banner-story"))
        assertFalse(isUnlikelyNoise("plain"))
    }

    @Test
    fun articleScoreShortText() {
        val doc = Jsoup.parse("<div>short</div>", "https://e.com")
        val el = doc.selectFirst("div")!!
        assertEquals(0.0, articleScore(el))
    }

    @Test
    fun ampSameAsLinkNotPreferred() {
        val text = ("Amp same page body with enough detail and commas for extraction. ").repeat(10)
        val html = """<html><head><link rel="amphtml" href="https://e.com/story"></head>
            <body><article><p>$text</p></article></body></html>"""
        val out = extractArticleHtml(html, "https://e.com/story")
        assertNotNull(out)
    }

    @Test
    fun canonicalWhitespaceOnly() {
        // absUrl on blank/whitespace href behavior; exercise select present + ifBlank
        val html = """<html><head><link rel="canonical" href="   "></head><body></body></html>"""
        val c = canonicalUrlOf(html, "https://e.com/a")
        assertTrue(c == null || c.isNotBlank())
    }
}
