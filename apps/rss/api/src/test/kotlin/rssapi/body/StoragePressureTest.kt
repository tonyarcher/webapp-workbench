package rssapi.body

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import rssapi.persist.ArticleBodyRepo

class StoragePressureTest {
    private val gb = 1024L * 1024L * 1024L

    @Test
    fun sizeThresholdTriggers() {
        val p = storagePressure(2 * gb, 0, BodyObjectStoreConfig())
        assertTrue(p.sizeTriggered)
        assertFalse(p.backupTriggered)
        assertTrue(p.triggered)
    }

    @Test
    fun backupThresholdTriggers() {
        val p = storagePressure(0, 15, BodyObjectStoreConfig())
        assertFalse(p.sizeTriggered)
        assertTrue(p.backupTriggered)
    }

    @Test
    fun belowBothThresholdsDoesNotTrigger() {
        val p = storagePressure(gb, 14, BodyObjectStoreConfig())
        assertFalse(p.triggered)
    }

    @Test
    fun zeroThresholdsNeverTrigger() {
        val p = storagePressure(10 * gb, 100, BodyObjectStoreConfig(dbSizeTriggerGb = 0, backupMinutesTrigger = 0))
        assertFalse(p.triggered)
    }

    @Test
    fun serviceReadsLiveSizeAndConfiguredBackupMinutes() {
        val bodies: ArticleBodyRepo = mock()
        whenever(bodies.databaseSizeBytes()).thenReturn(3 * gb)
        val config = BodyObjectStoreConfig(backupMinutes = 20, requirePressure = true)
        val service = StoragePressureService(bodies, config)

        val snapshot = service.snapshot()

        assertEquals(3 * gb, snapshot.databaseBytes)
        assertEquals(20, snapshot.backupMinutes)
        assertTrue(service.offloadAllowed())
    }

    @Test
    fun failedSizeProbeDoesNotTrigger() {
        val bodies: ArticleBodyRepo = mock()
        whenever(bodies.databaseSizeBytes()).thenThrow(RuntimeException("db down"))
        val service = StoragePressureService(bodies, BodyObjectStoreConfig(requirePressure = true))

        assertEquals(0L, service.snapshot().databaseBytes)
        assertFalse(service.offloadAllowed())
    }

    @Test
    fun requirePressureOffAllowsOffloadWithoutTrigger() {
        val bodies: ArticleBodyRepo = mock()
        val service = StoragePressureService(bodies, BodyObjectStoreConfig())
        assertTrue(service.offloadAllowed())
    }
}
