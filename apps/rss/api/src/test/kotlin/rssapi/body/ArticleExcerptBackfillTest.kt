package rssapi.body

import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import rssapi.persist.ArticleRepo

private class ExcerptRow(override val id: String, override val contentHtml: String?, override val link: String?) :
    ArticleRepo.ExcerptSource

class ArticleExcerptBackfillTest {
    private val articles: ArticleRepo = mock()
    private val backfill = ArticleExcerptBackfill(articles)

    @Test
    fun fillsExcerptAndImageThenStops() {
        val withImage = ExcerptRow(
            "a",
            "<p>Hello</p><img src=\"https://example.com/a.png\">",
            "https://example.com/a",
        )
        whenever(articles.excerptsToBackfill(any())).thenReturn(
            listOf(withImage, ExcerptRow("b", "<p>Plain</p>", null)),
            emptyList(),
        )

        backfill.runBatch()
        backfill.runBatch()
        backfill.runBatch()

        verify(articles, times(1)).setExcerpt("a", "Hello")
        verify(articles, times(1)).setExcerpt("b", "Plain")
        verify(articles, times(1)).setImageIfBlank("a", "https://example.com/a.png")
        verify(articles, times(2)).excerptsToBackfill(any())
    }

    @Test
    fun skipsRowsWithNoHtml() {
        whenever(articles.excerptsToBackfill(any())).thenReturn(listOf(ExcerptRow("a", null, null)))

        backfill.runBatch()

        verify(articles, never()).setExcerpt(any(), any())
    }

    @Test
    fun stopsOnDispose() {
        backfill.stop()

        backfill.runBatch()

        verify(articles, never()).excerptsToBackfill(any())
    }
}
