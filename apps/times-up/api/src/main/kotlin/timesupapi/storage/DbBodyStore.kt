package timesupapi.storage
import timesupapi.articles.ArticleRepo
import timesupapi.storage.ArticleBodyEntity
import timesupapi.storage.ArticleBodyRepo
import java.security.MessageDigest

/**
 * Bodies live in `article_bodies`; cold bodies are offloaded to the object
 * store. Objects are gzip and are read back through [ObjectText], so rows
 * written before compression existed still decode.
 */
class DbBodyStore(
    private val articles: ArticleRepo,
    private val bodies: ArticleBodyRepo,
    private val objectClient: BodyObjectClient = NoopBodyObjectClient(),
    private val objectConfig: BodyObjectStoreConfig = BodyObjectStoreConfig(),
) : BodyStore {
    override fun get(articleId: String): String? {
        val row = bodies.findById(articleId).orElse(null) ?: return null
        val key = row.storageKey
        if (!key.isNullOrBlank() && objectConfig.enabled()) {
            val text = runCatching { objectClient.get(key) }.getOrNull()?.let(ObjectText::decode)
            if (!text.isNullOrBlank()) return text
        }
        return row.contentHtml?.takeIf { it.isNotBlank() }
    }

    override fun getRaw(articleId: String): StoredText? {
        val row = bodies.findById(articleId).orElse(null) ?: return null
        val key = row.storageKey
        if (!key.isNullOrBlank() && objectConfig.enabled()) {
            val bytes = runCatching { objectClient.get(key) }.getOrNull()
            if (bytes != null && bytes.isNotEmpty()) return StoredText(bytes, ObjectText.isGzip(bytes))
        }
        val html = row.contentHtml?.takeIf { it.isNotBlank() } ?: return null
        return StoredText(ObjectText.encode(html), true)
    }

    override fun put(articleId: String, html: String) {
        // A blank body is indistinguishable from no body, and storing one adds
        // a row plus its foreign-key index entry for every link-only item.
        if (html.isBlank()) return
        if (!articles.existsById(articleId)) return
        // A store outage must not break ingest: fall back to the column, and the
        // offload pass moves the body later when the store recovers.
        val stored = if (objectConfig.enabled()) {
            upload(articleId, html)
        } else {
            null
        }
        bodies.save(stored ?: ArticleBodyEntity(articleId = articleId, contentHtml = html))
    }

    private fun upload(articleId: String, html: String): ArticleBodyEntity? {
        val bytes = ObjectText.encode(html)
        val key = objectKey(html.toByteArray(Charsets.UTF_8))
        if (!runCatching { objectClient.put(key, bytes) }.isSuccess) return null
        return ArticleBodyEntity(
            articleId = articleId,
            contentHtml = null,
            storageKey = key,
            byteSize = bytes.size.toLong(),
        )
    }

    /**
     * Keyed by the hash of the *uncompressed* text so the same body keeps one
     * key whether it was stored compressed or not.
     */
    internal fun objectKey(bytes: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
        val hex = digest.joinToString("") { "%02x".format(it) }
        val prefix = objectConfig.prefix.trim('/')
        return if (prefix.isBlank()) "$hex.html.gz" else "$prefix/$hex.html.gz"
    }
}
