package rssapi.storage
private const val BYTES_PER_GB = 1024L * 1024L * 1024L

/**Storage growth signal for automatic offload. Backups report their own duration. */
data class StoragePressure(
    val databaseBytes: Long,
    val backupMinutes: Long,
    val dbTriggerBytes: Long,
    val backupTriggerMinutes: Long,
) {
    val sizeTriggered: Boolean get() = dbTriggerBytes > 0 && databaseBytes >= dbTriggerBytes
    val backupTriggered: Boolean get() = backupTriggerMinutes > 0 && backupMinutes >= backupTriggerMinutes
    val triggered: Boolean get() = sizeTriggered || backupTriggered
}

/** Pure mapping from config, so the trigger decision is testable without a database. */
fun storagePressure(databaseBytes: Long, backupMinutes: Long, config: BodyObjectStoreConfig): StoragePressure =
    StoragePressure(
        databaseBytes = databaseBytes,
        backupMinutes = backupMinutes,
        dbTriggerBytes = config.dbSizeTriggerGb.coerceAtLeast(0) * BYTES_PER_GB,
        backupTriggerMinutes = config.backupMinutesTrigger.coerceAtLeast(0),
    )
