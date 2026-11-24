package timesupapi.storage
import jakarta.annotation.PreDestroy
import org.springframework.data.domain.PageRequest
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.transaction.support.TransactionTemplate
import timesupapi.platform.log.log
import timesupapi.storage.ArticleBodyRepo
import java.time.Duration
import java.time.Instant

private const val BATCH_SIZE = 200

/**
 * Deletes old cold objects, never article rows or user state. The body row
 * keeps its id so a later extraction can repopulate it; only the object
 * pointer is cleared. The scheduled pass and the confirmable endpoint share
 * one bounded implementation.
 */
@Component
class BodyPurgeService(
    private val bodies: ArticleBodyRepo,
    private val objectClient: BodyObjectClient,
    private val config: BodyObjectStoreConfig,
    private val transactions: TransactionTemplate,
) {
    @Volatile private var stopped = false

    @PreDestroy
    fun stop() {
        stopped = true
    }

    @Scheduled(fixedDelayString = "\${BODY_PURGE_MS:3600000}")
    fun scheduledPurge() {
        purgeOld()
    }

    fun purgeOld(): Int {
        if (stopped || !config.enabled() || !config.purgeEnabled) return 0
        val cutoff = Instant.now().minus(Duration.ofDays(config.purgeAfterDays.toLong().coerceAtLeast(1)))
        val rows = bodies.purgeCandidates(cutoff, PageRequest.of(0, BATCH_SIZE))
        val deleted = rows.takeWhile { !stopped }.sumOf { purgeOne(it) }
        if (deleted > 0) log("times-up-api", "info", "cold body purge", mapOf("purged" to deleted))
        return deleted
    }

    private fun purgeOne(row: ArticleBodyRepo.ColdRow): Int {
        var purged = false
        transactions.executeWithoutResult {
            bodies.lockStorageKey(row.storageKey)
            if (bodies.clearOffloaded(row.articleId, row.storageKey) == 0) return@executeWithoutResult
            purged = true
            // Pointer changes and offloads take the same advisory lock. Once
            // this pointer is gone, zero references means no concurrent writer
            // can add one before the object is deleted.
            if (bodies.countByStorageKey(row.storageKey) == 0L) {
                runCatching { objectClient.delete(row.storageKey) }
            }
        }
        return if (purged) 1 else 0
    }
}
