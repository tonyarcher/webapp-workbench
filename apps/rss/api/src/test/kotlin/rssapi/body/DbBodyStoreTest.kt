package rssapi.body

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
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

    @Test
    fun readsFromObjectStoreWhenKeyPresent() {
        val client: BodyObjectClient = mock()
        val s3Store = DbBodyStore(
            articles,
            bodies,
            client,
            BodyObjectStoreConfig(bucket = "b", prefix = "rss/bodies"),
        )
        whenever(bodies.findById("a")).thenReturn(Optional.of(ArticleBodyEntity("a", null, "k", 3)))
        whenever(client.get("k")).thenReturn("html".toByteArray(Charsets.UTF_8))

        assertEquals("html", s3Store.get("a"))
    }

    @Test
    fun fallsBackToContentHtmlWhenObjectMissing() {
        val client: BodyObjectClient = mock()
        val s3Store = DbBodyStore(
            articles,
            bodies,
            client,
            BodyObjectStoreConfig(bucket = "b"),
        )
        whenever(bodies.findById("a")).thenReturn(Optional.of(ArticleBodyEntity("a", "local", "k", 3)))
        whenever(client.get("k")).thenReturn(null)

        assertEquals("local", s3Store.get("a"))
    }

    @Test
    fun putWritesToObjectStoreWhenEnabled() {
        val client: BodyObjectClient = mock()
        val config = BodyObjectStoreConfig(bucket = "b", prefix = "rss/bodies")
        val s3Store = DbBodyStore(articles, bodies, client, config)
        whenever(articles.existsById("a")).thenReturn(true)

        s3Store.put("a", "<p>hi</p>")

        val key = argumentCaptor<String>()
        val bytes = argumentCaptor<ByteArray>()
        verify(client).put(key.capture(), bytes.capture())
        assertTrue(key.firstValue.startsWith("rss/bodies/"))
        assertTrue(key.firstValue.endsWith(".html"))
        val saved = argumentCaptor<ArticleBodyEntity>()
        verify(bodies).save(saved.capture())
        assertNull(saved.firstValue.contentHtml)
        assertEquals(key.firstValue, saved.firstValue.storageKey)
        assertEquals(bytes.firstValue.size.toLong(), saved.firstValue.byteSize)
    }

    @Test
    fun putWithoutObjectStoreKeepsContentHtml() {
        whenever(articles.existsById("a")).thenReturn(true)

        store.put("a", "<p>hi</p>")

        val saved = argumentCaptor<ArticleBodyEntity>()
        verify(bodies).save(saved.capture())
        assertEquals("<p>hi</p>", saved.firstValue.contentHtml)
        assertNull(saved.firstValue.storageKey)
    }

    @Test
    fun enabledStoreFallsBackWhenKeyBlank() {
        val client: BodyObjectClient = mock()
        val s3Store = DbBodyStore(articles, bodies, client, BodyObjectStoreConfig(bucket = "b"))
        whenever(bodies.findById("a")).thenReturn(Optional.of(ArticleBodyEntity("a", "local", " ", 1)))

        assertEquals("local", s3Store.get("a"))
        verify(client, never()).get(any())
    }

    @Test
    fun enabledStoreFallsBackWhenObjectBlank() {
        val client: BodyObjectClient = mock()
        val s3Store = DbBodyStore(articles, bodies, client, BodyObjectStoreConfig(bucket = "b"))
        whenever(bodies.findById("a")).thenReturn(Optional.of(ArticleBodyEntity("a", "local", "k", 1)))
        whenever(client.get("k")).thenReturn("   ".toByteArray(Charsets.UTF_8))

        assertEquals("local", s3Store.get("a"))
    }

    @Test
    fun enabledStoreFallsBackWhenObjectThrows() {
        val client: BodyObjectClient = mock()
        val s3Store = DbBodyStore(articles, bodies, client, BodyObjectStoreConfig(bucket = "b"))
        whenever(bodies.findById("a")).thenReturn(Optional.of(ArticleBodyEntity("a", "local", "k", 1)))
        whenever(client.get("k")).thenThrow(RuntimeException("boom"))

        assertEquals("local", s3Store.get("a"))
    }

    @Test
    fun objectKeyUsesBlankPrefix() {
        val s3Store = DbBodyStore(articles, bodies, mock(), BodyObjectStoreConfig(bucket = "b", prefix = ""))
        val key = s3Store.objectKey("hi".toByteArray())
        assertTrue(key.endsWith(".html"))
        assertTrue(!key.contains("/"))
    }
}
