package rssapi.domain

import kotlin.test.Test
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class ArticleExtractTinyTest {
    @Test
    fun usableHtmlWhenTextShortButPresent() {
        // html present but text too short -> null (covers text length false branch combo)
        val html = """<html><body><article><p>hi</p><p>there</p></article></body></html>"""
        assertNull(extractArticleHtml(html, "https://e.com/a"))
    }

    @Test
    fun blankAbsAttributeSkipped() {
        val text = ("A long enough paragraph for extraction with details and commas. ").repeat(8)
        val html = """<html><body><article><p>$text</p><a href="   ">x</a></article></body></html>"""
        assertNotNull(extractArticleHtml(html, "https://e.com/a"))
    }
}
