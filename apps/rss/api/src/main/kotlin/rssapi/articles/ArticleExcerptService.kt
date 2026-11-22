package rssapi.articles
import org.springframework.cache.annotation.Cacheable
import org.springframework.stereotype.Service

/** Shared, bounded excerpt reads. Feed id is safe to cache; access is checked by the caller. */
@Service
class ArticleExcerptService(private val articles: ArticleRepo) {
    @Cacheable(cacheNames = [ARTICLE_EXCERPT_CACHE], key = "#articleId")
    fun load(articleId: String): CachedArticleExcerpt? = articles.findById(articleId).orElse(null)?.let {
        CachedArticleExcerpt(it.feedId, it.excerpt)
    }
}
