package rssapi.body

import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import rssapi.persist.ArticleBodyRepo
import java.time.Instant

class BodyOffloadServiceTest {
    private val bodies: ArticleBodyRepo = mock()
    private val client: BodyObjectClient = mock()
    private val config = BodyObjectStoreConfig(bucket = "b", offloadEnabled = true, offloadAfterDays = 1)
    private val pressure: StoragePressureService = mock()
    private val service = BodyOffloadService(bodies, client, config, pressure)

    init {
        whenever(pressure.offloadAllowed()).thenReturn(true)
    }

    @Test
    fun disabledDoesNothing() {
        val disabled = BodyOffloadService(bodies, client, BodyObjectStoreConfig(), pressure)
        disabled.runBatch()
        verify(bodies, never()).offloadCandidates(any(), any())
    }

    @Test
    fun offloadsCandidate() {
        val row = mock<ArticleBodyRepo.OffloadRow>()
        whenever(row.articleId).thenReturn("a1")
        whenever(row.contentHtml).thenReturn("<p>hi</p>")
        whenever(bodies.offloadCandidates(any<Instant>(), any())).thenReturn(listOf(row))
        whenever(bodies.markOffloaded(any(), any(), any())).thenReturn(1)

        service.runBatch()

        verify(client).put(any(), any())
        verify(bodies).markOffloaded(any(), any(), any())
    }

    @Test
    fun stopPreventsRun() {
        service.stop()
        service.runBatch()
        verify(bodies, never()).offloadCandidates(any(), any())
    }

    @Test
    fun offloadDisabledByFlagDoesNothing() {
        val disabled =
            BodyOffloadService(bodies, client, BodyObjectStoreConfig(bucket = "b", offloadEnabled = false), pressure)
        disabled.runBatch()
        verify(bodies, never()).offloadCandidates(any(), any())
    }

    @Test
    fun emptyCandidatesDoesNothing() {
        whenever(bodies.offloadCandidates(any<Instant>(), any())).thenReturn(emptyList())
        service.runBatch()
        verify(client, never()).put(any(), any())
    }

    @Test
    fun blankBodySkipped() {
        val row = mock<ArticleBodyRepo.OffloadRow>()
        whenever(row.articleId).thenReturn("a1")
        whenever(row.contentHtml).thenReturn("  ")
        whenever(bodies.offloadCandidates(any<Instant>(), any())).thenReturn(listOf(row))

        service.runBatch()

        verify(client, never()).put(any(), any())
        verify(bodies, never()).markOffloaded(any(), any(), any())
    }

    @Test
    fun putFailureSkipsMark() {
        val row = mock<ArticleBodyRepo.OffloadRow>()
        whenever(row.articleId).thenReturn("a1")
        whenever(row.contentHtml).thenReturn("<p>hi</p>")
        whenever(bodies.offloadCandidates(any<Instant>(), any())).thenReturn(listOf(row))
        whenever(client.put(any(), any())).thenThrow(RuntimeException("boom"))

        service.runBatch()

        verify(bodies, never()).markOffloaded(any(), any(), any())
    }

    @Test
    fun markOffloadedZeroNotCounted() {
        val row = mock<ArticleBodyRepo.OffloadRow>()
        whenever(row.articleId).thenReturn("a1")
        whenever(row.contentHtml).thenReturn("<p>hi</p>")
        whenever(bodies.offloadCandidates(any<Instant>(), any())).thenReturn(listOf(row))
        whenever(bodies.markOffloaded(any(), any(), any())).thenReturn(0)

        service.runBatch()

        verify(client).put(any(), any())
    }

    @Test
    fun objectKeyBlankPrefix() {
        val svc = BodyOffloadService(bodies, client, BodyObjectStoreConfig(bucket = "b", prefix = ""), pressure)
        val key = svc.objectKey("x".toByteArray())
        assertTrue(key.endsWith(".html"))
        assertTrue(!key.contains("/"))
    }

    @Test
    fun pressureTriggerGatesOffload() {
        whenever(pressure.offloadAllowed()).thenReturn(false)
        service.runBatch()
        verify(bodies, never()).offloadCandidates(any(), any())
    }
}
