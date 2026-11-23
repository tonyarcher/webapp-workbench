package rssapi.storage
/** One stored text payload, still compressed when [gzip] is true. */
data class StoredText(val bytes: ByteArray, val gzip: Boolean)

/**
 * Storage for article bodies, keyed by the article id that is stable across
 * every tier. Bodies are gzip-compressed in the object store; readers that need
 * text inflate, and [getRaw] hands the compressed bytes on untouched.
 */
interface BodyStore {
    fun get(articleId: String): String?
    fun put(articleId: String, html: String)

    /** Compressed payload for a streaming response. Null when there is no body. */
    fun getRaw(articleId: String): StoredText?
}
