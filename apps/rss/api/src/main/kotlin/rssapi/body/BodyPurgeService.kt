package rssapi.body

import jakarta.annotation.PreDestroy
import org.springframework.data.domain.PageRequest
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import rssapi.log.log
import rssapi.persist.ArticleBodyRepo
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
        if (deleted > 0) log("rss-api", "info", "cold body purge", mapOf("purged" to deleted))
        return deleted
    }

    private fun purgeOne(row: ArticleBodyRepo.ColdRow): Int {
        // A hash key can be shared by identical bodies. Drop only this pointer
        // when another article still reads the object; delete it only when this
        // is the last reference. Either way, no article row is touched.
        if (bodies.countByStorageKey(row.storageKey) > 1) {
            return if (bodies.clearOffloaded(row.articleId, row.storageKey) > 0) 1 else 0
        }
        if (!runCatching { objectClient.delete(row.storageKey) }.isSuccess) return 0
        return if (bodies.clearOffloaded(row.articleId, row.storageKey) > 0) 1 else 0
    }
}
