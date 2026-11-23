package rssapi.articles
import org.springframework.cache.annotation.Cacheable
import org.springframework.stereotype.Service
import rssapi.storage.BodyObjectClient
import rssapi.storage.BodyObjectStoreConfig
import rssapi.storage.ObjectText

/**
 * Shared, bounded excerpt reads. Feed id is safe to cache; access is checked by
 * the caller.
 *
 * When the full excerpt is in the object store, this inflates it for the JSON
 * endpoint. The list and search paths read only the bounded head from the row,
 * so they never pay for a store round trip.
 */
@Service
class ArticleExcerptService(
    private val articles: ArticleRepo,
    private val objectClient: BodyObjectClient,
    private val objectConfig: BodyObjectStoreConfig,
) {
    @Cacheable(cacheNames = [ARTICLE_EXCERPT_CACHE], key = "#articleId")
    fun load(articleId: String): CachedArticleExcerpt? = articles.findById(articleId).orElse(null)?.let {
        CachedArticleExcerpt(it.feedId, fullText(it))
    }

    /** Full excerpt from the store, or the local head when there is no pointer. */
    fun fullText(article: ArticleEntity): String? {
        val key = article.excerptKey
        if (!key.isNullOrBlank() && objectConfig.enabled()) {
            val stored = runCatching { objectClient.get(key) }.getOrNull()?.let(ObjectText::decode)
            if (!stored.isNullOrBlank()) return stored
        }
        return article.excerpt
    }
}
