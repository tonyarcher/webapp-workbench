package timesupapi.storage

import org.springframework.stereotype.Component
import java.util.UUID

/** Compressed private snapshots, addressed by stable owner/article keys. */
@Component
class SnapshotStore(private val client: BodyObjectClient, private val config: BodyObjectStoreConfig) {
    fun put(kind: String, ownerId: UUID, articleId: String, html: String?): String? {
        if (!config.enabled() || html.isNullOrBlank()) return null
        val key = objectKey(kind, ownerId, articleId)
        return runCatching {
            client.put(key, ObjectText.encode(html))
            key
        }.getOrNull()
    }

    fun load(storageKey: String?, legacyHtml: String?): String? {
        if (!storageKey.isNullOrBlank() && config.enabled()) {
            val stored = runCatching { client.get(storageKey) }.getOrNull()?.let(ObjectText::decode)
            if (!stored.isNullOrBlank()) return stored
        }
        return legacyHtml?.takeIf { it.isNotBlank() }
    }

    internal fun objectKey(kind: String, ownerId: UUID, articleId: String): String {
        val prefix = config.snapshotPrefix.trim('/')
        val name = "${ObjectText.digestHex(articleId)}.html.gz"
        return if (prefix.isBlank()) "$kind/$ownerId/$name" else "$prefix/$kind/$ownerId/$name"
    }
}
