package rssapi.body

/**
 * Storage for article bodies, keyed by the article id that is stable across
 * every tier. Slice 1 keeps bodies in Postgres; later slices swap in the
 * object store without changing callers.
 */
interface BodyStore {
    fun get(articleId: String): String?
    fun put(articleId: String, html: String)
}
