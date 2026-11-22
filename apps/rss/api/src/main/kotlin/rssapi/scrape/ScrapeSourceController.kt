package rssapi.scrape
import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import org.springframework.http.HttpStatus
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import rssapi.feeds.FeedEntity
import rssapi.feeds.FeedJson
import rssapi.feeds.FeedRepo
import rssapi.feeds.SubscriptionEntity
import rssapi.feeds.SubscriptionRepo
import rssapi.fetch.PageFetcher
import rssapi.ingest.IngestService
import rssapi.ingest.IngestSync
import rssapi.platform.ApiException
import rssapi.platform.IdentityUser
import rssapi.platform.safeHttpUrl
import rssapi.platform.toJson
import java.net.URI
import java.util.UUID

data class CreateScrapeSourceBody(
    val url: String? = null,
    val selector: String? = null,
    val title: String? = null,
    val urls: List<String>? = null,
)

/** Turns a watched page into a normal subscribed feed, with scrape provenance. */
@RestController
class ScrapeSourceController(
    private val user: IdentityUser,
    private val feeds: FeedRepo,
    private val subs: SubscriptionRepo,
    private val sync: IngestSync,
    private val ingest: IngestService,
    private val pages: PageFetcher,
) {
    @PostMapping("/sources", headers = ["X-Api-Version=1"])
    @Transactional
    fun create(@RequestBody body: CreateScrapeSourceBody): FeedJson {
        val url = safeHttpUrl(body.url)
            ?: throw ApiException(HttpStatus.BAD_REQUEST, "Invalid page URL (must be http/https)")
        val doc = fetchDoc(url)
        val title = body.title?.trim()?.takeIf { it.isNotEmpty() } ?: doc.title().ifBlank { URI(url).host }
        val selector = body.selector?.trim()?.ifEmpty { null }
        val feed = findOrCreate(url, title, selector)
        subscribe(feed.id!!)
        sync.ensureRow(feed.id!!)
        ingestSelected(doc, feed, selector, body.urls)
        return feed.toJson(
            emptyList(),
            0,
            null,
            null,
            sourceKind = feed.sourceKind,
            itemSelector = feed.itemSelector,
        )
    }

    private fun ingestSelected(doc: Document, feed: FeedEntity, selector: String?, urls: List<String>?) {
        val found = ScrapeExtraction.best(doc, selector).extract(doc, feed.pageUrl ?: feed.xmlUrl)
        val chosen = if (urls.isNullOrEmpty()) found else found.filter { it.url in urls }
        if (chosen.isEmpty()) {
            throw ApiException(HttpStatus.BAD_REQUEST, "None of the selected articles were found on the page")
        }
        ingest.ingestScrapedCandidates(feed, chosen)
    }

    private fun fetchDoc(url: String): Document = try {
        Jsoup.parse(pages.fetchHtml(url), url)
    } catch (err: IllegalStateException) {
        throw ApiException(HttpStatus.BAD_REQUEST, "Could not fetch page: ${err.message ?: "error"}", err)
    }

    private fun findOrCreate(url: String, title: String, selector: String?): FeedEntity =
        feeds.findByXmlUrl(url)?.takeIf { it.sourceKind == "scrape" }
            ?: feeds.save(
                FeedEntity(xmlUrl = url, title = title, sourceKind = "scrape", pageUrl = url, itemSelector = selector),
            )

    private fun subscribe(feedId: UUID) {
        if (!subs.existsByUserIdAndFeedId(user.id, feedId)) {
            subs.save(SubscriptionEntity(userId = user.id, feedId = feedId))
        }
    }
}
