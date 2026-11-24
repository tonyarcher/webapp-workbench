package timesupapi.storage
import jakarta.annotation.PreDestroy
import org.springframework.data.domain.PageRequest
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.transaction.support.TransactionTemplate
import timesupapi.platform.log.log
import timesupapi.storage.ArticleBodyRepo
import java.security.MessageDigest
import java.time.Duration
import java.time.Instant

private const val BATCH_SIZE = 200

/**
 * Moves bodies to the object store when offload is enabled.
 *
 * `offloadAfterDays = 0` means every stored body is a candidate: the reader
 * keeps only the article row plus user state in Postgres, and bodies are read
 * back from the store on demand.
 */
@Component
class BodyOffloadService(
    private val bodies: ArticleBodyRepo,
    private val objectClient: BodyObjectClient,
    private val config: BodyObjectStoreConfig,
    private val pressure: StoragePressureService,
    private val transactions: TransactionTemplate,
) {
    @Volatile private var stopped = false

    @PreDestroy
    fun stop() {
        stopped = true
    }

    @Scheduled(fixedDelayString = "\${BODY_OFFLOAD_MS:60000}")
    fun runBatch() {
        if (!canRun()) return
        val rows = bodies.offloadCandidates(cutoff(), PageRequest.of(0, BATCH_SIZE))
        if (rows.isEmpty()) return
        val moved = rows.count { offloadOne(it.articleId, it.contentHtml) }
        if (moved > 0) log("times-up-api", "info", "body offload batch", mapOf("moved" to moved))
    }

    /** Zero days means everything already fetched, not a one-day floor. */
    internal fun cutoff(): Instant {
        val days = config.offloadAfterDays.coerceAtLeast(0)
        val now = Instant.now()
        return if (days == 0) now else now.minus(Duration.ofDays(days.toLong()))
    }

    private fun canRun(): Boolean = !stopped && config.enabled() && config.offloadEnabled && pressure.offloadAllowed()

    private fun offloadOne(articleId: String, html: String?): Boolean {
        val body = html?.takeIf { it.isNotBlank() } ?: return false
        val bytes = ObjectText.encode(body)
        val key = objectKey(body.toByteArray(Charsets.UTF_8))
        var moved = false
        transactions.executeWithoutResult {
            bodies.lockStorageKey(key)
            val current = bodies.findById(articleId).orElse(null) ?: return@executeWithoutResult
            if (current.storageKey != null || current.contentHtml != body) return@executeWithoutResult
            if (!runCatching { objectClient.put(key, bytes) }.isSuccess) return@executeWithoutResult
            moved = bodies.markOffloaded(articleId, key, bytes.size.toLong(), body) > 0
        }
        return moved
    }

    internal fun objectKey(bytes: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
        val hex = digest.joinToString("") { "%02x".format(it) }
        val prefix = config.prefix.trim('/')
        return if (prefix.isBlank()) "$hex.html.gz" else "$prefix/$hex.html.gz"
    }
}
