package rssapi.scrape
import org.jsoup.nodes.Document
import rssapi.platform.safeHttpUrl
import java.net.URI

data class FeedCandidate(
    val url: String,
    val title: String,
    val type: String,
    val source: String,
    val confidence: Float,
)

private const val FEED_PATH = "/(feed|rss|atom|feeds|comments)[0-9]*(/|\\.(xml|rss|atom|json))?/?$"
private val REL_TYPES = listOf(
    "application/rss+xml" to "rss",
    "application/atom+xml" to "atom",
    "application/feed+json" to "json",
    "application/json" to "json",
    "text/xml" to "rss",
)
private val PATH_PATTERN = Regex(FEED_PATH, RegexOption.IGNORE_CASE)
private const val MAX_DISCOVERED = 8
private const val EXPLICIT_CONFIDENCE = 0.9f
private const val LINKED_CONFIDENCE = 0.6f

/** Reads the feeds a page advertises through link tags or ordinary links. */
object FeedDiscovery {
    fun candidates(doc: Document, baseUrl: String): List<FeedCandidate> = doc
        .select("link[rel~=(?i)alternate][href], a[href]")
        .mapNotNull(::candidate)
        .filter { it.url != baseUrl }
        .distinctBy { it.url }
        .sortedByDescending { it.confidence }
        .take(MAX_DISCOVERED)

    private fun candidate(element: org.jsoup.nodes.Element): FeedCandidate? {
        val type = element.attr("type").lowercase()
        val href = element.absUrl("href").ifBlank { element.attr("href") }
        val url = safeHttpUrl(href) ?: return null
        val kind = kindOf(type, url) ?: return null
        val label = element.attr("title").ifBlank { element.text() }.ifBlank { URI(url).host }
        val explicit = type.isNotBlank()
        return FeedCandidate(
            url,
            label,
            kind,
            if (explicit) "advertised" else "linked",
            if (explicit) EXPLICIT_CONFIDENCE else LINKED_CONFIDENCE,
        )
    }

    private fun kindOf(type: String, url: String): String? {
        REL_TYPES.firstOrNull { type.startsWith(it.first) }?.let { return it.second }
        if (url.endsWith(".json", ignoreCase = true)) return "json"
        if (url.endsWith(".atom", ignoreCase = true)) return "atom"
        if (PATH_PATTERN.containsMatchIn(URI(url).path)) return "rss"
        return null
    }
}
