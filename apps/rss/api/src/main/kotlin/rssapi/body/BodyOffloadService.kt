package rssapi.body

import jakarta.annotation.PreDestroy
import org.springframework.data.domain.PageRequest
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import rssapi.log.log
import rssapi.persist.ArticleBodyRepo
import java.security.MessageDigest
import java.time.Duration
import java.time.Instant

private const val BATCH_SIZE = 200

/** Moves old hot bodies to the object store when offload is enabled. */
@Component
class BodyOffloadService(
    private val bodies: ArticleBodyRepo,
    private val objectClient: BodyObjectClient,
    private val config: BodyObjectStoreConfig,
    private val pressure: StoragePressureService,
) {
    @Volatile private var stopped = false

    @PreDestroy
    fun stop() {
        stopped = true
    }

    @Scheduled(fixedDelayString = "\${BODY_OFFLOAD_MS:60000}")
    @Transactional
    fun runBatch() {
        if (!canRun()) return
        val cutoff = Instant.now().minus(Duration.ofDays(config.offloadAfterDays.toLong().coerceAtLeast(1)))
        val rows = bodies.offloadCandidates(cutoff, PageRequest.of(0, BATCH_SIZE))
        if (rows.isEmpty()) return
        val moved = rows.count { offloadOne(it.articleId, it.contentHtml) }
        if (moved > 0) log("rss-api", "info", "body offload batch", mapOf("moved" to moved))
    }

    private fun canRun(): Boolean = !stopped && config.enabled() && config.offloadEnabled && pressure.offloadAllowed()

    private fun offloadOne(articleId: String, html: String?): Boolean {
        val body = html?.takeIf { it.isNotBlank() } ?: return false
        val bytes = body.toByteArray(Charsets.UTF_8)
        val key = objectKey(bytes)
        if (!runCatching { objectClient.put(key, bytes) }.isSuccess) return false
        return bodies.markOffloaded(articleId, key, bytes.size.toLong()) > 0
    }

    internal fun objectKey(bytes: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
        val hex = digest.joinToString("") { "%02x".format(it) }
        val prefix = config.prefix.trim('/')
        return if (prefix.isBlank()) "$hex.html" else "$prefix/$hex.html"
    }
}
