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
import rssapi.persist.ArticleRepo
import java.util.Optional

class DbBodyStoreTest {
    private val articles: ArticleRepo = mock()
    private val bodies: ArticleBodyRepo = mock()
    private val store = DbBodyStore(articles, bodies)

    @Test
    fun readsFromBodyTable() {
        whenever(bodies.findById("a")).thenReturn(Optional.of(ArticleBodyEntity("a", "body")))

        assertEquals("body", store.get("a"))
        verify(articles, never()).findById(any())
    }

    @Test
    fun missingBodyReturnsNull() {
        whenever(bodies.findById("a")).thenReturn(Optional.empty())

        assertNull(store.get("a"))
    }

    @Test
    fun blankBodyRowReturnsNull() {
        whenever(bodies.findById("a")).thenReturn(Optional.of(ArticleBodyEntity("a", "")))

        assertNull(store.get("a"))
    }

    @Test
    fun writesBodyOnly() {
        whenever(articles.existsById("a")).thenReturn(true)

        store.put("a", "new")

        val saved = argumentCaptor<ArticleBodyEntity>()
        verify(bodies).save(saved.capture())
        assertEquals("a", saved.firstValue.articleId)
        assertEquals("new", saved.firstValue.contentHtml)
        verify(articles, never()).save(any())
    }

    @Test
    fun missingArticleIsNotSaved() {
        whenever(articles.existsById("a")).thenReturn(false)

        store.put("a", "new")

        verify(bodies, never()).save(any())
    }

    @Test
    fun blankBodyIsNotStored() {
        store.put("a", "   ")

        verify(bodies, never()).save(any())
        verify(articles, never()).existsById(any())
    }
}
