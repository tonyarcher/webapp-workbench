package rssapi.body

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleRepo
import java.util.Optional

class DbBodyStoreTest {
    private val articles: ArticleRepo = mock()
    private val store = DbBodyStore(articles)

    @Test
    fun readsStoredBody() {
        whenever(articles.findById("a")).thenReturn(Optional.of(ArticleEntity(id = "a", contentHtml = "body")))

        assertEquals("body", store.get("a"))
    }

    @Test
    fun missingArticleHasNoBody() {
        whenever(articles.findById("a")).thenReturn(Optional.empty())

        assertNull(store.get("a"))
    }

    @Test
    fun writesChangedBody() {
        val article = ArticleEntity(id = "a", contentHtml = "old")
        whenever(articles.findById("a")).thenReturn(Optional.of(article))

        store.put("a", "new")

        assertEquals("new", article.contentHtml)
        verify(articles).save(article)
    }

    @Test
    fun unchangedBodyIsNotSaved() {
        val article = ArticleEntity(id = "a", contentHtml = "body")
        whenever(articles.findById("a")).thenReturn(Optional.of(article))

        store.put("a", "body")

        verify(articles, never()).save(article)
    }

    @Test
    fun missingArticleIsNotSaved() {
        whenever(articles.findById("a")).thenReturn(Optional.empty())

        store.put("a", "new")

        verify(articles, never()).save(org.mockito.kotlin.any())
    }
}
