package rssapi.storage
data class BodyResult(val html: String?, val fromStore: Boolean)

/**
 * Read a body from the store, fetching it only on a miss. A missing or broken
 * store never breaks the view: the fetched body still goes to the caller, and
 * a failed fetch simply leaves the caller with no body.
 */
class BodyReadThrough(private val store: BodyStore) {
    fun load(articleId: String, fetch: () -> String?): BodyResult {
        val cached = runCatching { store.get(articleId) }.getOrNull()
        if (!cached.isNullOrBlank()) return BodyResult(cached, true)
        val fetched = runCatching { fetch() }.getOrNull()
        if (fetched.isNullOrBlank()) return BodyResult(null, false)
        runCatching { store.put(articleId, fetched) }
        return BodyResult(fetched, false)
    }
}
