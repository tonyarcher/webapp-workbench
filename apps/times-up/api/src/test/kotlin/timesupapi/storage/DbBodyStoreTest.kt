package timesupapi.storage
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import timesupapi.articles.ArticleRepo
import java.util.Optional

class DbBodyStoreTest {
    private val articles: ArticleRepo = mock()
    private val bodies: ArticleBodyRepo = mock()
    private val client = InMemoryClient()
    private val store = DbBodyStore(articles, bodies, client, BodyObjectStoreConfig(bucket = "b"))

    private class InMemoryClient : BodyObjectClient {
        val objects = mutableMapOf<String, ByteArray>()

        override fun put(key: String, bytes: ByteArray) {
            objects[key] = bytes
        }

        override fun get(key: String): ByteArray? = objects[key]

        override fun delete(key: String) {
            objects.remove(key)
        }
    }

    @Test
    fun putStoresLocallyWithoutNetworkIO() {
        whenever(articles.existsById("a1")).thenReturn(true)
        val captor = argumentCaptor<ArticleBodyEntity>()

        store.put("a1", "<p>hello</p>")

        verify(bodies).save(captor.capture())
        assertEquals("<p>hello</p>", captor.firstValue.contentHtml)
        assertNull(captor.firstValue.storageKey)
        assertTrue(client.objects.isEmpty())
    }

    @Test
    fun getInflatesAnOffloadedBody() {
        val key = "rss/bodies/x.html.gz"
        client.objects[key] = ObjectText.encode("<p>hi</p>")
        whenever(bodies.findById("a1")).thenReturn(
            Optional.of(ArticleBodyEntity(articleId = "a1", contentHtml = null, storageKey = key)),
        )

        assertEquals("<p>hi</p>", store.get("a1"))
    }

    @Test
    fun getStillReadsAnUncompressedLegacyObject() {
        val key = "rss/bodies/legacy.html"
        client.objects[key] = "<p>old</p>".toByteArray(Charsets.UTF_8)
        whenever(bodies.findById("a1")).thenReturn(
            Optional.of(ArticleBodyEntity(articleId = "a1", storageKey = key)),
        )

        assertEquals("<p>old</p>", store.get("a1"))
    }

    @Test
    fun getFallsBackToTheColumnWhenTheStoreMisses() {
        whenever(bodies.findById("a1")).thenReturn(
            Optional.of(ArticleBodyEntity(articleId = "a1", contentHtml = "<p>row</p>", storageKey = "missing")),
        )

        assertEquals("<p>row</p>", store.get("a1"))
    }

    @Test
    fun getRawPassesCompressedBytesThrough() {
        val key = "rss/bodies/x.html.gz"
        val gz = ObjectText.encode("<p>hi</p>")
        client.objects[key] = gz
        whenever(bodies.findById("a1")).thenReturn(Optional.of(ArticleBodyEntity(articleId = "a1", storageKey = key)))

        val raw = store.getRaw("a1")

        assertTrue(raw?.gzip == true)
        assertEquals(gz.toList(), raw?.bytes?.toList())
    }

    @Test
    fun getRawCompressesAColumnBodyForStreaming() {
        whenever(
            bodies.findById("a1"),
        ).thenReturn(Optional.of(ArticleBodyEntity(articleId = "a1", contentHtml = "<p>hi</p>")))

        val raw = store.getRaw("a1")

        assertTrue(raw?.gzip == true)
        assertEquals("<p>hi</p>", ObjectText.decode(raw!!.bytes))
    }

    @Test
    fun missingRowHasNoBody() {
        whenever(bodies.findById("a1")).thenReturn(Optional.empty())
        assertNull(store.get("a1"))
        assertNull(store.getRaw("a1"))
    }

    @Test
    fun blankBodyIsNotStored() {
        store.put("a1", "   ")
        verify(bodies, org.mockito.kotlin.never()).save(any())
        assertFalse(client.objects.isNotEmpty())
    }

    @Test
    fun unknownArticleIsNotStored() {
        whenever(articles.existsById("gone")).thenReturn(false)

        store.put("gone", "<p>body</p>")

        verify(bodies, org.mockito.kotlin.never()).save(any())
        assertTrue(client.objects.isEmpty())
    }

    @Test
    fun emptyPrefixStillProducesAFlatKey() {
        val flat = DbBodyStore(articles, bodies, client, BodyObjectStoreConfig(bucket = "b", prefix = ""))

        val key = flat.objectKey("x".toByteArray())

        assertFalse(key.startsWith("/"))
        assertTrue(key.endsWith(".html.gz"))
    }

    @Test
    fun getRawFallsBackWhenTheObjectIsEmpty() {
        val key = "rss/bodies/empty.html.gz"
        client.objects[key] = ByteArray(0)
        whenever(bodies.findById("a1")).thenReturn(
            Optional.of(ArticleBodyEntity(articleId = "a1", contentHtml = "<p>row</p>", storageKey = key)),
        )

        val raw = store.getRaw("a1")

        assertEquals("<p>row</p>", ObjectText.decode(raw!!.bytes))
    }

    @Test
    fun putKeepsTheColumnWhenTheStoreIsOff() {
        val local = DbBodyStore(articles, bodies, client, BodyObjectStoreConfig())
        whenever(articles.existsById("a1")).thenReturn(true)
        val captor = argumentCaptor<ArticleBodyEntity>()

        local.put("a1", "<p>kept</p>")

        verify(bodies).save(captor.capture())
        assertEquals("<p>kept</p>", captor.firstValue.contentHtml)
        assertNull(captor.firstValue.storageKey)
    }

    @Test
    fun putFallsBackToTheColumnWhenTheUploadFails() {
        val failing = object : BodyObjectClient {
            override fun put(key: String, bytes: ByteArray) = throw IllegalStateException("down")
            override fun get(key: String): ByteArray? = null
            override fun delete(key: String) = Unit
        }
        val local = DbBodyStore(articles, bodies, failing, BodyObjectStoreConfig(bucket = "b"))
        whenever(articles.existsById("a1")).thenReturn(true)
        val captor = argumentCaptor<ArticleBodyEntity>()

        local.put("a1", "<p>kept</p>")

        verify(bodies).save(captor.capture())
        assertEquals("<p>kept</p>", captor.firstValue.contentHtml)
    }

    @Test
    fun getWithoutAKeyReadsTheColumn() {
        whenever(
            bodies.findById("a1"),
        ).thenReturn(Optional.of(ArticleBodyEntity(articleId = "a1", contentHtml = "<p>row</p>")))

        assertEquals("<p>row</p>", store.get("a1"))
    }

    @Test
    fun blankKeyIsTreatedAsNoPointer() {
        whenever(bodies.findById("a1")).thenReturn(
            Optional.of(ArticleBodyEntity(articleId = "a1", contentHtml = "<p>row</p>", storageKey = "  ")),
        )

        assertEquals("<p>row</p>", store.get("a1"))
        assertEquals("<p>row</p>", ObjectText.decode(store.getRaw("a1")!!.bytes))
    }

    @Test
    fun storeOffIgnoresThePointer() {
        val local = DbBodyStore(articles, bodies, client, BodyObjectStoreConfig())
        whenever(bodies.findById("a1")).thenReturn(
            Optional.of(
                ArticleBodyEntity(articleId = "a1", contentHtml = "<p>row</p>", storageKey = "rss/bodies/x"),
            ),
        )

        assertEquals("<p>row</p>", local.get("a1"))
        assertEquals("<p>row</p>", ObjectText.decode(local.getRaw("a1")!!.bytes))
    }

    @Test
    fun storeExceptionFallsBackToTheColumn() {
        val failing = object : BodyObjectClient {
            override fun put(key: String, bytes: ByteArray) = Unit
            override fun get(key: String): ByteArray? = throw IllegalStateException("boom")
            override fun delete(key: String) = Unit
        }
        val local = DbBodyStore(articles, bodies, failing, BodyObjectStoreConfig(bucket = "b"))
        whenever(bodies.findById("a1")).thenReturn(
            Optional.of(
                ArticleBodyEntity(articleId = "a1", contentHtml = "<p>row</p>", storageKey = "rss/bodies/x"),
            ),
        )

        assertEquals("<p>row</p>", local.get("a1"))
        assertEquals("<p>row</p>", ObjectText.decode(local.getRaw("a1")!!.bytes))
    }

    @Test
    fun getRawWithoutAColumnOrObjectIsNull() {
        whenever(bodies.findById("a1")).thenReturn(
            Optional.of(
                ArticleBodyEntity(articleId = "a1", contentHtml = "  ", storageKey = "rss/bodies/missing"),
            ),
        )

        assertNull(store.getRaw("a1"))
    }
}
