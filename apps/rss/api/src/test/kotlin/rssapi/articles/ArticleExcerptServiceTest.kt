package rssapi.articles
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import java.util.Optional
import java.util.UUID

class ArticleExcerptServiceTest {
    private val articles: ArticleRepo = mock()
    private val service = ArticleExcerptService(articles)
    private val feedId: UUID = UUID.randomUUID()

    @Test
    fun loadsFeedIdAndExcerptFromRepository() {
        whenever(articles.findById("a1")).thenReturn(
            Optional.of(ArticleEntity(id = "a1", feedId = feedId, excerpt = "text")),
        )

        val result = service.load("a1")

        assertEquals(feedId, result?.feedId)
        assertEquals("text", result?.excerpt)
    }

    @Test
    fun missingArticleReturnsNull() {
        whenever(articles.findById("missing")).thenReturn(Optional.empty())

        assertNull(service.load("missing"))
    }
}
