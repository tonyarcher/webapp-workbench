package rssapi.scrape

import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import rssapi.domain.parseFeedXml
import rssapi.fetch.FeedFetcher
import rssapi.fetch.PageFetcher
import rssapi.web.ApiException

private const val MAX_PREVIEWS = 3
private const val MAX_TITLES = 3
private const val NO_FEEDS_STATUS = 422

data class DiscoveredFeed(
    val url: String,
    val title: String,
    val type: String,
    val source: String,
    val confidence: Float,
    val recentTitles: List<String> = emptyList(),
    val lastPublished: Long? = null,
)

data class DiscoveryResult(val baseUrl: String, val siteTitle: String?, val feeds: List<DiscoveredFeed>)

/** Fetches a site once, finds its feeds, then peeks at the strongest few. */
@Service
class FeedDiscoveryService(private val pages: PageFetcher, private val feeds: FeedFetcher) {
    fun discover(url: String?): DiscoveryResult {
        val target = ScrapeFetch.target(url)
        val doc = ScrapeFetch.doc(pages, target)
        val found = FeedDiscovery.candidates(doc, target)
        if (found.isEmpty()) {
            throw ApiException(HttpStatus.valueOf(NO_FEEDS_STATUS), "No feeds found on this site")
        }
        return DiscoveryResult(
            baseUrl = target,
            siteTitle = doc.title().ifBlank { null },
            feeds = found.take(MAX_PREVIEWS).map(::peek),
        )
    }

    private fun peek(candidate: FeedCandidate): DiscoveredFeed = try {
        val result = feeds.fetch(candidate.url)
        val parsed = result.text?.let { parseFeedXml(it, 0L) }
        DiscoveredFeed(
            url = candidate.url,
            title = parsed?.title?.ifBlank { candidate.title } ?: candidate.title,
            type = candidate.type,
            source = candidate.source,
            confidence = candidate.confidence,
            recentTitles = parsed?.items?.take(MAX_TITLES)?.map { it.title } ?: emptyList(),
            lastPublished = parsed?.items?.firstOrNull()?.published,
        )
    } catch (_: Exception) {
        DiscoveredFeed(candidate.url, candidate.title, candidate.type, candidate.source, candidate.confidence)
    }
}
