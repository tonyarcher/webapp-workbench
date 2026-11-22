package rssapi.body

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import rssapi.persist.ArticleBodyEntity
import rssapi.persist.ArticleBodyRepo
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleRepo
import java.util.Optional

class DbBodyStoreTest {
    private val articles: ArticleRepo = mock()
    private val bodies: ArticleBodyRepo = mock()
    private val store = DbBodyStore(articles, bodies)

    @Test
    fun readsFromBodyTableFirst() {
        whenever(bodies.findById("a")).thenReturn(Optional.of(ArticleBodyEntity("a", "body")))

        assertEquals("body", store.get("a"))
        verify(articles, never()).findById(any())
    }

    @Test
    fun fallsBackToArticleColumn() {
        whenever(articles.findById("a")).thenReturn(Optional.of(ArticleEntity(id = "a", contentHtml = "old")))

        assertEquals("old", store.get("a"))
    }

    @Test
    fun missingArticleHasNoBody() {
        assertNull(store.get("a"))
    }

    @Test
    fun writesBothCopies() {
        val article = ArticleEntity(id = "a", contentHtml = "old")
        whenever(articles.findById("a")).thenReturn(Optional.of(article))

        store.put("a", "new")

        val saved = argumentCaptor<ArticleBodyEntity>()
        verify(bodies).save(saved.capture())
        assertEquals("a", saved.firstValue.articleId)
        assertEquals("new", saved.firstValue.contentHtml)
        assertEquals("new", article.contentHtml)
        verify(articles).save(article)
    }

    @Test
    fun unchangedArticleColumnIsNotSaved() {
        val article = ArticleEntity(id = "a", contentHtml = "new")
        whenever(articles.findById("a")).thenReturn(Optional.of(article))

        store.put("a", "new")

        verify(bodies, org.mockito.kotlin.times(1)).save(any())
        verify(articles, never()).save(any())
    }

    @Test
    fun missingArticleIsNotSaved() {
        store.put("a", "new")

        verify(bodies, never()).save(any())
        verify(articles, never()).save(any())
    }
}
