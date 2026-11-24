package timesupapi.storage
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import timesupapi.ingest.testTransactionTemplate
import timesupapi.storage.ArticleBodyRepo
import java.time.Instant

class BodyPurgeServiceTest {
    private val bodies: ArticleBodyRepo = mock()
    private val client: BodyObjectClient = mock()
    private val config = BodyObjectStoreConfig(bucket = "b", purgeEnabled = true, purgeAfterDays = 30)
    private val service = BodyPurgeService(bodies, client, config, testTransactionTemplate())

    private fun row(articleId: String = "a1", key: String = "k1"): ArticleBodyRepo.ColdRow =
        mock<ArticleBodyRepo.ColdRow>().apply {
            whenever(this.articleId).thenReturn(articleId)
            whenever(this.storageKey).thenReturn(key)
        }

    @Test
    fun disabledDoesNothing() {
        val disabled = BodyPurgeService(bodies, client, BodyObjectStoreConfig(), testTransactionTemplate())
        assertEquals(0, disabled.purgeOld())
        verify(bodies, never()).purgeCandidates(any(), any())
    }

    @Test
    fun purgesObjectAndClearsPointer() {
        val cold = row()
        whenever(bodies.purgeCandidates(any<Instant>(), any())).thenReturn(listOf(cold))
        whenever(bodies.clearOffloaded("a1", "k1")).thenReturn(1)

        assertEquals(1, service.purgeOld())

        verify(client).delete("k1")
        verify(bodies).clearOffloaded("a1", "k1")
        verify(bodies, never()).delete(any())
    }

    @Test
    fun sharedKeyOnlyClearsPointer() {
        val cold = row()
        whenever(bodies.purgeCandidates(any<Instant>(), any())).thenReturn(listOf(cold))
        whenever(bodies.countByStorageKey("k1")).thenReturn(2)
        whenever(bodies.clearOffloaded("a1", "k1")).thenReturn(1)

        assertEquals(1, service.purgeOld())

        verify(client, never()).delete(any())
        verify(bodies).clearOffloaded("a1", "k1")
    }

    @Test
    fun failedDeleteStillClearsTheDanglingPointer() {
        val cold = row()
        whenever(bodies.purgeCandidates(any<Instant>(), any())).thenReturn(listOf(cold))
        whenever(bodies.clearOffloaded("a1", "k1")).thenReturn(1)
        whenever(client.delete(any())).thenThrow(RuntimeException("boom"))

        assertEquals(1, service.purgeOld())
        verify(bodies).clearOffloaded("a1", "k1")
    }

    @Test
    fun failedClearDoesNotDeleteTheObject() {
        val cold = row()
        whenever(bodies.purgeCandidates(any<Instant>(), any())).thenReturn(listOf(cold))
        whenever(bodies.clearOffloaded(any(), any())).thenReturn(0)

        assertEquals(0, service.purgeOld())
        verify(client, never()).delete(any())
    }

    @Test
    fun emptyCandidatesDoesNothing() {
        whenever(bodies.purgeCandidates(any<Instant>(), any())).thenReturn(emptyList())
        assertEquals(0, service.purgeOld())
        verify(client, never()).delete(any())
    }

    @Test
    fun stoppedDoesNothing() {
        service.stop()
        assertEquals(0, service.purgeOld())
        verify(bodies, never()).purgeCandidates(any(), any())
    }

    @Test
    fun scheduledPurgeUsesSamePath() {
        whenever(bodies.purgeCandidates(any<Instant>(), any())).thenReturn(emptyList())
        service.scheduledPurge()
        verify(bodies).purgeCandidates(any<Instant>(), any())
    }
}
