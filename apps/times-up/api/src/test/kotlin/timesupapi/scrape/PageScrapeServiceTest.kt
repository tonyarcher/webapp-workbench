package timesupapi.scrape
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import timesupapi.fetch.PageFetcher
import timesupapi.platform.ApiException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

private const val PAGE_URL = "https://example.com/blog"
private const val ARTICLES = """
    <html><head><title>Blog</title></head><body>
      <article><h2><a href="/one">One</a></h2></article>
      <article><h2><a href="/two">Two</a></h2></article>
    </body></html>
"""

class PageScrapeServiceTest {
    private val pages: PageFetcher = mock()
    private val service = PageScrapeService(pages, listOf(SemanticListExtractor(), JsonLdListExtractor()))

    private fun statusOf(block: () -> Unit): Int = assertFailsWith<ApiException>(block = block).status.value()

    @Test
    fun picksTheBestExtractor() {
        whenever(pages.fetchHtml(PAGE_URL)).thenReturn(ARTICLES)
        val result = service.preview(PAGE_URL, null)
        assertEquals("semantic-list", result.strategies.first().id)
        assertEquals("Blog", result.title)
        assertEquals(2, result.strategies.first().candidates.size)
        assertEquals(PAGE_URL, result.baseUrl)
        assertEquals(true, result.html.contains("One"))
        assertEquals(false, result.html.contains("<script"))
    }

    @Test
    fun selectorOverridesAutomaticChoice() {
        whenever(pages.fetchHtml(PAGE_URL)).thenReturn(ARTICLES)
        val result = service.preview(PAGE_URL, "article")
        val custom = result.strategies.first { it.id == "selector" }
        assertEquals(2, custom.candidates.size)
        assertEquals("article", custom.selector)
    }

    @Test
    fun blankSelectorUsesAutomaticChoice() {
        whenever(pages.fetchHtml(PAGE_URL)).thenReturn(ARTICLES)
        assertEquals("semantic-list", service.preview(PAGE_URL, "  ").strategies.first().id)
    }

    @Test
    fun jsonLdBoxesPointAtRealElements() {
        val html = """
            <html><body>
              <script type="application/ld+json">{"@type":"ItemList","itemListElement":[
                {"headline":"One","url":"/one"}]}</script>
              <article id="one"><a href="/one">One</a></article>
            </body></html>
        """.trimIndent()
        whenever(pages.fetchHtml(PAGE_URL)).thenReturn(html)
        val strategy = service.preview(PAGE_URL, null).strategies.first { it.id == "json-ld-list" }
        assertEquals("https://example.com/one", strategy.candidates.first().url)
        assertEquals("#one", strategy.candidates.first().elementSelector)
    }

    @Test
    fun excerptIsSafeForPreview() {
        whenever(pages.fetchHtml(PAGE_URL)).thenReturn(
            "<script>alert(1)</script><article><a href='/a'>A</a></article><article><a href='/b'>B</a></article>",
        )
        val html = service.preview(PAGE_URL, null).html
        assertEquals(false, html.contains("alert"))
        assertEquals(false, html.contains("<script"))
        assertEquals(true, html.contains("A"))
    }

    @Test
    fun rejectsInvalidUrl() {
        assertEquals(400, statusOf { service.preview("javascript:alert(1)", null) })
        assertEquals(400, statusOf { service.preview(null, null) })
    }

    @Test
    fun reportsFetchFailure() {
        whenever(pages.fetchHtml(PAGE_URL)).thenThrow(IllegalStateException("down"))
        assertEquals(400, statusOf { service.preview(PAGE_URL, null) })
    }

    @Test
    fun handlesMissingTitleAndMessagelessFailure() {
        whenever(
            pages.fetchHtml(PAGE_URL),
        ).thenReturn("<article><a href='/a'>A</a></article><article><a href='/b'>B</a></article>")
        assertEquals(null, service.preview(PAGE_URL, null).title)
        whenever(pages.fetchHtml(PAGE_URL)).thenThrow(IllegalStateException())
        assertEquals(400, statusOf { service.preview(PAGE_URL, null) })
    }

    @Test
    fun reportsPagesWithoutAList() {
        whenever(pages.fetchHtml(PAGE_URL)).thenReturn("<html><body><p>nothing</p></body></html>")
        assertEquals(422, statusOf { service.preview(PAGE_URL, null) })
    }

    @Test
    fun reportsEmptySelectorMatch() {
        whenever(pages.fetchHtml(PAGE_URL)).thenReturn(ARTICLES)
        val result = service.preview(PAGE_URL, ".missing")
        assertEquals(0, result.strategies.first { it.id == "selector" }.candidates.size)
    }

    @Test
    fun reportsInvalidSelector() {
        whenever(pages.fetchHtml(PAGE_URL)).thenReturn(ARTICLES)
        assertEquals(400, statusOf { service.preview(PAGE_URL, "[unclosed") })
    }
}
