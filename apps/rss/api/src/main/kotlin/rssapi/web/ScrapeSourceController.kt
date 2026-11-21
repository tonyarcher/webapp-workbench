package rssapi.web

import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import org.springframework.http.HttpStatus
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import rssapi.domain.safeHttpUrl
import rssapi.fetch.PageFetcher
import rssapi.ingest.IngestService
import rssapi.ingest.IngestSync
import rssapi.persist.FeedEntity
import rssapi.persist.FeedRepo
import rssapi.persist.SubscriptionEntity
import rssapi.persist.SubscriptionRepo
import java.net.URI
import java.util.UUID

data class CreateScrapeSourceBody(val url: String? = null, val selector: String? = null, val title: String? = null)

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
        val feed = findOrCreate(url, title, body.selector?.trim()?.ifEmpty { null })
        subscribe(feed.id!!)
        sync.ensureRow(feed.id!!)
        ingest.scrapeAndIngest(feed)
        return feed.toJson(
            emptyList(),
            0,
            null,
            null,
            sourceKind = feed.sourceKind,
            itemSelector = feed.itemSelector,
        )
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
