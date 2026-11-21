package rssapi.ingest

import rssapi.MAX_CONTENT_BYTES
import rssapi.domain.ParsedItem
import rssapi.domain.extractArticleHtml
import rssapi.domain.safeHttpUrl
import rssapi.domain.sanitizeHtml
import rssapi.fetch.PageFetcher

/** One-time full-text enrichment for a newly stored article. */
object ArticleFullText {
    fun of(pages: PageFetcher, item: ParsedItem, fallback: String): String {
        val link = safeHttpUrl(item.link) ?: return fallback
        return try {
            val body = extractArticleHtml(pages.fetchHtml(link), link) ?: return fallback
            sanitizeHtml(body).take(MAX_CONTENT_BYTES).ifBlank { fallback }
        } catch (_: Exception) {
            fallback
        }
    }
}
