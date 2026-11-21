package rssapi.scrape

import org.jsoup.Jsoup
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

private const val HTML = """
    <article><h2><a href="/one">One</a></h2><p>first</p></article>
    <article><h2><a href="/two">Two</a></h2><p>second</p></article>
"""

class ScrapeExtractionTest {
    @Test
    fun selectorWinsOverAutomaticChoice() {
        val extractor = ScrapeExtraction.best(Jsoup.parse(HTML, "https://example.com"), ".post")
        assertEquals("selector", extractor.id)
    }

    @Test
    fun automaticChoicePicksTheSemanticList() {
        val extractor = ScrapeExtraction.best(Jsoup.parse(HTML, "https://example.com"), null)
        assertEquals("semantic-list", extractor.id)
    }

    @Test
    fun blankSelectorUsesAutomaticChoice() {
        val extractor = ScrapeExtraction.best(Jsoup.parse(HTML, "https://example.com"), "  ")
        assertEquals("semantic-list", extractor.id)
    }

    @Test
    fun plainPageHasNoExtractor() {
        val doc = Jsoup.parse("<p>nothing</p>", "https://example.com")
        assertFailsWith<IllegalArgumentException> { ScrapeExtraction.best(doc, null) }
    }

    @Test
    fun itemsUseCandidateDatesAndContent() {
        val candidates = listOf(
            ScrapeCandidate("One", "https://example.com/one", 123L, "first"),
            ScrapeCandidate("Two", "https://example.com/two", null, null),
        )
        val items = ScrapeExtraction.items(candidates, 999L)
        assertEquals(123L, items[0].published)
        assertEquals("<p>first</p>", items[0].content)
        assertEquals(999L, items[1].published)
        assertNull(items[1].content)
    }
}
