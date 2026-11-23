package rssapi.storage
import jakarta.annotation.PreDestroy
import org.springframework.data.domain.PageRequest
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import rssapi.articles.ArticleRepo
import rssapi.platform.log.log
import java.security.MessageDigest

private const val BATCH_SIZE = 200

/**
 * Moves full excerpts to the object store, gzip, leaving a bounded head in
 * Postgres.
 *
 * The head is what `rss_search_text`, list previews, and cited-id lookups read, so
 * they never touch the store. Set `RSS_EXCERPT_HEAD_CHARS` to 0 to keep the
 * text only in the store, at the cost of search over excerpt text.
 */
@Component
class ExcerptOffloadService(
    private val articles: ArticleRepo,
    private val objectClient: BodyObjectClient,
    private val config: BodyObjectStoreConfig,
) {
    @Volatile private var stopped = false

    @PreDestroy
    fun stop() {
        stopped = true
    }

    @Scheduled(fixedDelayString = "\${RSS_EXCERPT_OFFLOAD_MS:60000}")
    @Transactional
    fun runBatch() {
        if (stopped || !config.enabled() || !config.excerptOffloadEnabled) return
        val rows = articles.excerptOffloadCandidates(PageRequest.of(0, BATCH_SIZE))
        if (rows.isEmpty()) return
        val moved = rows.count { offloadOne(it) }
        if (moved > 0) log("rss-api", "info", "excerpt offload batch", mapOf("moved" to moved))
    }

    private fun offloadOne(row: ArticleRepo.ExcerptRow): Boolean {
        val text = row.excerpt.takeIf { it.isNotBlank() } ?: return false
        val bytes = ObjectText.encode(text)
        val key = objectKey(text.toByteArray(Charsets.UTF_8))
        if (!runCatching { objectClient.put(key, bytes) }.isSuccess) return false
        return articles.markExcerptOffloaded(row.id, key, bytes.size.toLong(), head(text), text) > 0
    }

    /** Bound what stays in the row; a zero head is allowed on purpose. */
    internal fun head(text: String): String {
        val limit = config.excerptHeadChars
        return if (limit <= 0 || text.length <= limit) {
            if (limit <= 0) "" else text
        } else {
            text.take(limit)
        }
    }

    internal fun objectKey(bytes: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
        val hex = digest.joinToString("") { "%02x".format(it) }
        val prefix = config.excerptPrefix.trim('/')
        return if (prefix.isBlank()) "$hex.txt.gz" else "$prefix/$hex.txt.gz"
    }
}
