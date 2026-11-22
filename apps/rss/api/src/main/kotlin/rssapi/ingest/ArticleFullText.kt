package rssapi.ingest
import rssapi.feeds.ParsedItem
import rssapi.fetch.PageFetcher
import rssapi.ingest.extractArticleHtml
import rssapi.platform.MAX_CONTENT_BYTES
import rssapi.platform.safeHttpUrl
import rssapi.platform.sanitizeHtml
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
