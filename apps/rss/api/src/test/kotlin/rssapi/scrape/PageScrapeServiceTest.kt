package rssapi.scrape

import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import rssapi.fetch.PageFetcher
import rssapi.web.ApiException
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
        assertEquals("semantic-list", result.strategy)
        assertEquals("Blog", result.title)
        assertEquals(2, result.candidates.size)
    }

    @Test
    fun selectorOverridesAutomaticChoice() {
        whenever(pages.fetchHtml(PAGE_URL)).thenReturn(ARTICLES)
        val result = service.preview(PAGE_URL, "article")
        assertEquals("selector", result.strategy)
        assertEquals(2, result.candidates.size)
    }

    @Test
    fun blankSelectorUsesAutomaticChoice() {
        whenever(pages.fetchHtml(PAGE_URL)).thenReturn(ARTICLES)
        assertEquals("semantic-list", service.preview(PAGE_URL, "  ").strategy)
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
        assertEquals(422, statusOf { service.preview(PAGE_URL, ".missing") })
    }

    @Test
    fun reportsInvalidSelector() {
        whenever(pages.fetchHtml(PAGE_URL)).thenReturn(ARTICLES)
        assertEquals(400, statusOf { service.preview(PAGE_URL, "[unclosed") })
    }
}
