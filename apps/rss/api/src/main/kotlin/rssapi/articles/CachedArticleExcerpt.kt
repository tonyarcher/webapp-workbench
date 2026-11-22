package rssapi.articles
import java.util.UUID

/** Feed id is not user data; it lets the caller check access from cache. */
data class CachedArticleExcerpt(val feedId: UUID, val excerpt: String?)
