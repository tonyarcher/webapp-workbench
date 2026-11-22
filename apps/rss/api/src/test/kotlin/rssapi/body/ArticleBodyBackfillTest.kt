package rssapi.body

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import rssapi.persist.ArticleBodyEntity
import rssapi.persist.ArticleBodyRepo
import rssapi.persist.ArticleRepo

private class Source(override val id: String, override val contentHtml: String?) : ArticleRepo.BodySource

class ArticleBodyBackfillTest {
    private val articles: ArticleRepo = mock()
    private val bodies: ArticleBodyRepo = mock()
    private val backfill = ArticleBodyBackfill(articles, bodies)

    @Test
    fun copiesBatchThenStopsWhenEmpty() {
        whenever(articles.bodiesToBackfill(any())).thenReturn(
            listOf(Source("a", "one"), Source("b", "two")),
            emptyList(),
        )

        backfill.runBatch()
        backfill.runBatch()
        backfill.runBatch()

        val saved = argumentCaptor<Iterable<ArticleBodyEntity>>()
        verify(bodies, times(1)).saveAll(saved.capture())
        assertEquals(listOf("a", "b"), saved.firstValue.map { it.articleId })
        assertEquals(listOf("one", "two"), saved.firstValue.map { it.contentHtml })
        verify(articles, times(2)).bodiesToBackfill(any())
    }

    @Test
    fun stopPreventsFurtherBatches() {
        backfill.stop()

        backfill.runBatch()

        verify(articles, never()).bodiesToBackfill(any())
    }
}
