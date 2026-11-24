package timesupapi.ingest
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import timesupapi.feeds.ParsedItem
import timesupapi.fetch.PageFetcher
import kotlin.test.Test
import kotlin.test.assertEquals

private const val LINK = "https://example.com/story"
private const val BODY =
    "This is the article body with enough text to be considered a real paragraph by the extractor. " +
        "It keeps going so the text density score is comfortably above the minimum for the main-article heuristic. " +
        "A final sentence closes the piece and makes the whole fragment unmistakably article-like."

class ArticleFullTextTest {
    private val pages: PageFetcher = mock()
    private val item = ParsedItem(guid = "g1", title = "Story", link = LINK, summary = "short", published = 0L)

    @Test
    fun extractsTheArticleBody() {
        whenever(pages.fetchHtml(LINK)).thenReturn("<html><body><article><p>$BODY</p></article></body></html>")
        assertEquals("<p>$BODY</p>", ArticleFullText.of(pages, item, "short"))
    }

    @Test
    fun fallsBackWhenNoBodyIsFound() {
        whenever(pages.fetchHtml(LINK)).thenReturn("<html><body><p>short</p></body></html>")
        assertEquals("short", ArticleFullText.of(pages, item, "short"))
    }

    @Test
    fun fallsBackWhenFetchFails() {
        whenever(pages.fetchHtml(LINK)).thenThrow(IllegalStateException("down"))
        assertEquals("short", ArticleFullText.of(pages, item, "short"))
    }

    @Test
    fun skipsUnsafeLinks() {
        val unsafe = item.copy(link = "javascript:alert(1)")
        assertEquals("short", ArticleFullText.of(pages, unsafe, "short"))
    }
}
