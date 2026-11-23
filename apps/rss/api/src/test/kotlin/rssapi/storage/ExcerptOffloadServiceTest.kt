package rssapi.storage
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import rssapi.articles.ArticleRepo

class ExcerptOffloadServiceTest {
    private val articles: ArticleRepo = mock()
    private val client: BodyObjectClient = mock()
    private val config = BodyObjectStoreConfig(
        bucket = "b",
        excerptOffloadEnabled = true,
        excerptHeadChars = 10,
    )
    private val service = ExcerptOffloadService(articles, client, config)

    private fun row(id: String = "a1", text: String = "0123456789abcdef") = object : ArticleRepo.ExcerptRow {
        override val id = id
        override val excerpt = text
    }

    @Test
    fun storesTheFullExcerptAndKeepsABoundedHead() {
        whenever(articles.excerptOffloadCandidates(any())).thenReturn(listOf(row()))
        whenever(articles.markExcerptOffloaded(any(), any(), any(), any(), any())).thenReturn(1)

        service.runBatch()

        verify(client).put(any(), any())
        verify(articles).markExcerptOffloaded(eq("a1"), any(), any(), eq("0123456789"), eq("0123456789abcdef"))
    }

    @Test
    fun disabledDoesNothing() {
        val off = ExcerptOffloadService(articles, client, BodyObjectStoreConfig(bucket = "b"))
        off.runBatch()
        verify(articles, never()).excerptOffloadCandidates(any())
    }

    @Test
    fun missingBucketDoesNothing() {
        val off = ExcerptOffloadService(articles, client, BodyObjectStoreConfig(excerptOffloadEnabled = true))
        off.runBatch()
        verify(articles, never()).excerptOffloadCandidates(any())
    }

    @Test
    fun stopPreventsRun() {
        service.stop()
        service.runBatch()
        verify(articles, never()).excerptOffloadCandidates(any())
    }

    @Test
    fun uploadFailureLeavesTheRowAlone() {
        whenever(articles.excerptOffloadCandidates(any())).thenReturn(listOf(row()))
        whenever(client.put(any(), any())).thenThrow(RuntimeException("boom"))

        service.runBatch()

        verify(articles, never()).markExcerptOffloaded(any(), any(), any(), any(), any())
    }

    @Test
    fun blankExcerptIsSkipped() {
        whenever(articles.excerptOffloadCandidates(any())).thenReturn(listOf(row(text = "  ")))

        service.runBatch()

        verify(client, never()).put(any(), any())
    }

    @Test
    fun zeroHeadDropsTheLocalCopy() {
        val zero = ExcerptOffloadService(articles, client, config.copy(excerptHeadChars = 0))
        assertEquals("", zero.head("some text"))
    }

    @Test
    fun shortTextIsKeptWhole() {
        assertEquals("short", service.head("short"))
    }

    @Test
    fun keyIsContentAddressedAndCompressed() {
        val key = service.objectKey("x".toByteArray())
        assertTrue(key.startsWith("rss/excerpts/"))
        assertTrue(key.endsWith(".txt.gz"))
    }

    @Test
    fun emptyPrefixStillProducesAFlatKey() {
        val flat = ExcerptOffloadService(articles, client, config.copy(excerptPrefix = ""))

        val key = flat.objectKey("x".toByteArray())

        assertFalse(key.startsWith("/"))
        assertTrue(key.endsWith(".txt.gz"))
    }

    @Test
    fun candidateFailureCountsAsNothingMoved() {
        whenever(articles.excerptOffloadCandidates(any())).thenReturn(listOf(row()))
        whenever(articles.markExcerptOffloaded(any(), any(), any(), any(), any())).thenReturn(0)

        service.runBatch()

        verify(client).put(any(), any())
    }

    @Test
    fun emptyBatchStopsEarly() {
        whenever(articles.excerptOffloadCandidates(any())).thenReturn(emptyList())
        service.runBatch()
        verify(client, never()).put(any(), any())
    }
}
