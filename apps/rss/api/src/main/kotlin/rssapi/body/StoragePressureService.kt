package rssapi.body

import org.springframework.stereotype.Component
import rssapi.persist.ArticleBodyRepo

/** Reads the live database size and exposes the offload trigger decision. */
@Component
class StoragePressureService(private val bodies: ArticleBodyRepo, private val config: BodyObjectStoreConfig) {
    /** A failed size probe is a 0-byte reading: never trigger from bad telemetry. */
    fun snapshot(): StoragePressure = storagePressure(
        databaseBytes = runCatching { bodies.databaseSizeBytes() }.getOrDefault(0L),
        backupMinutes = config.backupMinutes,
        config = config,
    )

    fun offloadAllowed(): Boolean = !config.requirePressure || snapshot().triggered
}
