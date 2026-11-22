package rssapi.ingest
import org.springframework.cache.annotation.CacheEvict
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import rssapi.articles.ARTICLE_EXCERPT_CACHE
import rssapi.articles.ArticleEntity
import rssapi.articles.ArticleRepo
import rssapi.articles.excerptOf
import rssapi.feeds.SubscriptionRepo
import rssapi.feeds.firstImageUrl
import rssapi.fetch.PageFetcher
import rssapi.ingest.ampUrlOf
import rssapi.ingest.extractArticleHtml
import rssapi.platform.ApiException
import rssapi.platform.MAX_CONTENT_BYTES
import rssapi.platform.safeHttpUrl
import rssapi.platform.sanitizeHtml
import rssapi.platform.stripHtml
import rssapi.storage.BodyStore
import java.util.UUID

private const val MIN_GAIN_CHARS = 300

data class ExtractResult(val article: ArticleEntity, val extracted: Boolean, val sourceUrl: String?)

@Service
class ArticleExtractService(
    private val articles: ArticleRepo,
    private val subs: SubscriptionRepo,
    private val pages: PageFetcher,
    private val bodyStore: BodyStore,
) {
    @CacheEvict(cacheNames = [ARTICLE_EXCERPT_CACHE], key = "#articleId")
    fun extractForUser(userId: UUID, articleId: String): ExtractResult {
        val article = articles.findById(articleId).orElseThrow {
            ApiException(HttpStatus.NOT_FOUND, "Article not found")
        }
        if (article.feedId !in subs.findFeedIdsByUserId(userId).toSet()) {
            throw ApiException(HttpStatus.NOT_FOUND, "Article not found")
        }
        val link = safeHttpUrl(article.link)
            ?: throw ApiException(HttpStatus.BAD_REQUEST, "Article has no fetchable link")
        val (html, source) = fetchBest(link)
            ?: return ExtractResult(article, false, null)
        val sanitized = sanitizeHtml(html).take(MAX_CONTENT_BYTES)
        if (!isMeaningfulGain(article, sanitized)) return ExtractResult(article, false, source)
        article.excerpt = excerptOf(sanitized)
        article.image = firstImageUrl(sanitized, article.link)
        val saved = articles.save(article)
        bodyStore.put(article.id, sanitized)
        return ExtractResult(saved, true, source)
    }

    /**
     * Try clever fetch strategies: original page, then AMP alternate if it
     * yields fuller extractable text. Returns unsanitized extracted fragment.
     */
    private fun fetchBest(link: String): Pair<String, String>? {
        val primary = runCatching { pages.fetchHtml(link) }.getOrNull()
        val primaryExtract = primary?.let { extractArticleHtml(it, link) }
        if (primary != null) {
            val amp = safeHttpUrl(ampUrlOf(primary, link))
            if (amp != null && amp != link) {
                val ampPage = runCatching { pages.fetchHtml(amp) }.getOrNull()
                val ampExtract = ampPage?.let { extractArticleHtml(it, amp) }
                if (betterThan(ampExtract, primaryExtract)) return ampExtract!! to amp
            }
            if (primaryExtract != null) return primaryExtract to link
        }
        return null
    }

    private fun betterThan(candidate: String?, current: String?): Boolean {
        if (candidate == null) return false
        if (current == null) return true
        return stripHtml(candidate).length >= stripHtml(current).length + MIN_GAIN_CHARS / 2
    }

    private fun isMeaningfulGain(article: ArticleEntity, candidateHtml: String): Boolean {
        val current = stripHtml(bodyStore.get(article.id) ?: article.summary).length
        val next = stripHtml(candidateHtml).length
        return next >= current + MIN_GAIN_CHARS
    }
}
