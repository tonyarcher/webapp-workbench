package timesupapi.ingest
import timesupapi.feeds.ParsedItem
import timesupapi.fetch.PageFetcher
import timesupapi.ingest.extractArticleHtml
import timesupapi.platform.MAX_CONTENT_BYTES
import timesupapi.platform.safeHttpUrl
import timesupapi.platform.sanitizeHtml
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
