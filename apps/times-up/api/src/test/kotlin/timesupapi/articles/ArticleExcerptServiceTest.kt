package timesupapi.articles
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import timesupapi.storage.BodyObjectClient
import timesupapi.storage.BodyObjectStoreConfig
import timesupapi.storage.ObjectText
import java.util.Optional
import java.util.UUID

class ArticleExcerptServiceTest {
    private val articles: ArticleRepo = mock()
    private val client: BodyObjectClient = mock()
    private val service = ArticleExcerptService(articles, client, BodyObjectStoreConfig(bucket = "b"))
    private val feedId = UUID.randomUUID()

    private fun article(excerpt: String?, key: String?) =
        ArticleEntity(id = "a1", feedId = feedId, excerpt = excerpt, excerptKey = key)

    @Test
    fun readsTheFullExcerptFromTheStore() {
        val full = "x".repeat(4000)
        whenever(articles.findById("a1")).thenReturn(Optional.of(article("head", "rss/excerpts/k.txt.gz")))
        whenever(client.get("rss/excerpts/k.txt.gz")).thenReturn(ObjectText.encode(full))

        val loaded = service.load("a1")

        assertEquals(full, loaded?.excerpt)
    }

    @Test
    fun fallsBackToTheLocalHeadWhenThereIsNoPointer() {
        whenever(articles.findById("a1")).thenReturn(Optional.of(article("head", null)))

        assertEquals("head", service.load("a1")?.excerpt)
    }

    @Test
    fun storeFailureFallsBackToTheHead() {
        whenever(articles.findById("a1")).thenReturn(Optional.of(article("head", "missing")))
        whenever(client.get("missing")).thenReturn(null)

        assertEquals("head", service.load("a1")?.excerpt)
    }

    @Test
    fun unknownArticleIsNull() {
        whenever(articles.findById("nope")).thenReturn(Optional.empty())
        assertNull(service.load("nope"))
    }

    @Test
    fun disabledStoreReadsOnlyTheLocalHead() {
        val local = ArticleExcerptService(articles, client, BodyObjectStoreConfig())
        whenever(articles.findById("a1")).thenReturn(Optional.of(article("head", "rss/excerpts/k.txt.gz")))

        assertEquals("head", local.load("a1")?.excerpt)
    }

    @Test
    fun replaceExcerptDropsTheStaleStorePointer() {
        val a = article("old", "rss/excerpts/old.txt.gz").apply { excerptBytes = 42 }

        a.replaceExcerpt("new")

        assertEquals("new", a.excerpt)
        assertNull(a.excerptKey)
        assertNull(a.excerptBytes)
    }
}
