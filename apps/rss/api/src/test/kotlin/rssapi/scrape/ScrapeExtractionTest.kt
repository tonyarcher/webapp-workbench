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

private const val HTML_SIMPLE = """
    <article><a href="/one">One</a></article>
    <article><a href="/two">Two</a></article>
"""

private const val HTML_JSON = """
    <script type="application/ld+json">{"@type":"ItemList","itemListElement":[
      {"headline":"One","url":"/one"},{"headline":"Two","url":"/two"}
    ]}</script>
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
    fun byIdAndUnknownStrategy() {
        val doc = Jsoup.parse(HTML_SIMPLE, "https://example.com")
        assertEquals("semantic-list", ScrapeExtraction.byId(doc, "semantic-list")?.id)
        assertEquals(null, ScrapeExtraction.byId(doc, "nope"))
        assertFailsWith<IllegalArgumentException> { ScrapeExtraction.best(doc, "strategy:nope") }
    }

    @Test
    fun allReturnsJsonLdStrategy() {
        val doc = Jsoup.parse(HTML_JSON, "https://example.com")
        assertEquals(1, ScrapeExtraction.all(doc).size)
        assertEquals("json-ld-list", ScrapeExtraction.all(doc).first().id)
        assertEquals(1, ScrapeExtraction.all(Jsoup.parse(HTML_SIMPLE, "https://example.com")).size)
    }

    @Test
    fun bestWithBlankSelectorReturnsHighestConfidence() {
        val doc = Jsoup.parse(HTML_SIMPLE, "https://example.com")
        assertEquals("semantic-list", ScrapeExtraction.best(doc, null).id)
        assertEquals("semantic-list", ScrapeExtraction.best(doc, "  ").id)
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
