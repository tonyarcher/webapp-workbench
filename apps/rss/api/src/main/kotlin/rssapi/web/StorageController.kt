package rssapi.web

import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RestController
import rssapi.body.BodyObjectStoreConfig
import rssapi.body.BodyPurgeService
import rssapi.body.StoragePressureService

data class StorageStatusJson(
    val objectStoreEnabled: Boolean,
    val offloadEnabled: Boolean,
    val requirePressure: Boolean,
    val databaseBytes: Long,
    val dbTriggerBytes: Long,
    val backupMinutes: Long,
    val backupTriggerMinutes: Long,
    val pressureTriggered: Boolean,
    val purgeEnabled: Boolean,
    val purgeAfterDays: Int,
)

data class PurgeResultJson(val purged: Int)

/** Storage tier status and the confirmable purge action. Article rows are never touched. */
@RestController
class StorageController(
    private val config: BodyObjectStoreConfig,
    private val pressure: StoragePressureService,
    private val purge: BodyPurgeService,
) {
    @GetMapping("/storage/status", headers = ["X-Api-Version=1"])
    fun status(): StorageStatusJson {
        val snapshot = pressure.snapshot()
        return StorageStatusJson(
            objectStoreEnabled = config.enabled(),
            offloadEnabled = config.offloadEnabled,
            requirePressure = config.requirePressure,
            databaseBytes = snapshot.databaseBytes,
            dbTriggerBytes = snapshot.dbTriggerBytes,
            backupMinutes = snapshot.backupMinutes,
            backupTriggerMinutes = snapshot.backupTriggerMinutes,
            pressureTriggered = snapshot.triggered,
            purgeEnabled = config.purgeEnabled,
            purgeAfterDays = config.purgeAfterDays,
        )
    }

    @PostMapping("/storage/purge", headers = ["X-Api-Version=1"])
    fun purge(): PurgeResultJson {
        if (!config.enabled() || !config.purgeEnabled) throw ApiException(HttpStatus.NOT_FOUND, "Not found")
        return PurgeResultJson(purged = purge.purgeOld())
    }
}
