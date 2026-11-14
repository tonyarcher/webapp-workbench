package rssapi.ingest

import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import rssapi.MAX_CONTENT_BYTES
import rssapi.domain.ampUrlOf
import rssapi.domain.extractArticleHtml
import rssapi.domain.safeHttpUrl
import rssapi.domain.sanitizeHtml
import rssapi.domain.stripHtml
import rssapi.fetch.PageFetcher
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleRepo
import rssapi.persist.SubscriptionRepo
import rssapi.web.ApiException
import java.util.UUID

private const val MIN_GAIN_CHARS = 300

data class ExtractResult(val article: ArticleEntity, val extracted: Boolean, val sourceUrl: String?)

@Service
class ArticleExtractService(
    private val articles: ArticleRepo,
    private val subs: SubscriptionRepo,
    private val pages: PageFetcher,
) {
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
        article.contentHtml = sanitized
        val saved = articles.save(article)
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
        val current = stripHtml(article.contentHtml ?: article.summary).length
        val next = stripHtml(candidateHtml).length
        return next >= current + MIN_GAIN_CHARS
    }
}
