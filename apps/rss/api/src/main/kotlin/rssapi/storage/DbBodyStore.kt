package rssapi.storage
import rssapi.articles.ArticleRepo
import rssapi.storage.ArticleBodyEntity
import rssapi.storage.ArticleBodyRepo
import java.security.MessageDigest

/** Bodies live in `article_bodies`; cold bodies may be offloaded to object store. */
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
            val bytes = runCatching { objectClient.get(key) }.getOrNull()
            val text = bytes?.toString(Charsets.UTF_8)?.takeIf { it.isNotBlank() }
            if (text != null) return text
        }
        return row.contentHtml?.takeIf { it.isNotBlank() }
    }

    override fun put(articleId: String, html: String) {
        // A blank body is indistinguishable from no body, and storing one adds
        // a row plus its foreign-key index entry for every link-only item.
        if (html.isBlank()) return
        if (!articles.existsById(articleId)) return
        val row = if (objectConfig.enabled()) {
            val bytes = html.toByteArray(Charsets.UTF_8)
            val key = objectKey(bytes)
            runCatching { objectClient.put(key, bytes) }.getOrThrow()
            ArticleBodyEntity(
                articleId = articleId,
                contentHtml = null,
                storageKey = key,
                byteSize = bytes.size.toLong(),
            )
        } else {
            ArticleBodyEntity(articleId = articleId, contentHtml = html)
        }
        bodies.save(row)
    }

    internal fun objectKey(bytes: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
        val hex = digest.joinToString("") { "%02x".format(it) }
        val prefix = objectConfig.prefix.trim('/')
        return if (prefix.isBlank()) "$hex.html" else "$prefix/$hex.html"
    }
}
