package timesupapi.storage
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import timesupapi.platform.ApiException

class StorageControllerTest {
    private val config = BodyObjectStoreConfig(bucket = "b", purgeEnabled = true)
    private val pressure: StoragePressureService = mock()
    private val purge: BodyPurgeService = mock()
    private val controller = StorageController(config, pressure, purge)

    @Test
    fun statusReportsStorageTier() {
        whenever(pressure.snapshot()).thenReturn(
            StoragePressure(
                databaseBytes = 100,
                backupMinutes = 4,
                dbTriggerBytes = 50,
                backupTriggerMinutes = 15,
            ),
        )

        val status = controller.status()

        assertEquals(true, status.objectStoreEnabled)
        assertEquals(100L, status.databaseBytes)
        assertEquals(50L, status.dbTriggerBytes)
        assertEquals(4L, status.backupMinutes)
        assertTrue(status.pressureTriggered)
        assertEquals(true, status.purgeEnabled)
        assertEquals(365, status.purgeAfterDays)
    }

    @Test
    fun purgeReturnsCountWhenEnabled() {
        whenever(purge.purgeOld()).thenReturn(3)

        assertEquals(3, controller.purge().purged)
        verify(purge).purgeOld()
    }

    @Test
    fun purgeIs404WhenDisabled() {
        val disabled = BodyObjectStoreConfig()
        val ctrl = StorageController(disabled, pressure, purge)

        val err = assertThrows<ApiException> { ctrl.purge() }

        assertEquals(HttpStatus.NOT_FOUND, err.status)
    }
}
