package rssapi.ingest
import org.jsoup.Jsoup
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.xml.sax.SAXException
import rssapi.MAX_ARTICLES_PER_FEED
import rssapi.MAX_CONTENT_BYTES
import rssapi.domain.EngagementInput
import rssapi.domain.ParsedItem
import rssapi.domain.contentEngagement
import rssapi.domain.domainOf
import rssapi.domain.firstImageUrl
import rssapi.domain.makeArticleId
import rssapi.domain.normalizeLink
import rssapi.domain.parseFeedXml
import rssapi.domain.sanitizeHtml
import rssapi.fetch.FeedFetcher
import rssapi.fetch.PageFetcher
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleMaintenanceRepo
import rssapi.persist.ArticleRepo
import rssapi.persist.FeedEntity
import rssapi.persist.FeedRepo
import rssapi.scrape.ScrapeCandidate
import rssapi.scrape.ScrapeExtraction
import java.time.Instant
import java.util.UUID

/** 304 Not Modified: the feed is unchanged since the stored validators. */
private fun ArticleEntity.sameContent(other: ArticleEntity): Boolean = title == other.title &&
    link == other.link &&
    summary == other.summary &&
    contentHtml == other.contentHtml &&
    publishedAt == other.publishedAt

private const val NOT_MODIFIED = 304
private const val SCRAPE_KIND = "scrape"
private const val MAX_SCRAPE_ITEMS = 50

@Service
class IngestService(
    private val feeds: FeedRepo,
    private val articles: ArticleRepo,
    private val maintenance: ArticleMaintenanceRepo,
    private val sync: IngestSync,
    private val pending: PendingApply,
    private val fetcher: FeedFetcher,
    private val pages: PageFetcher,
) {
    @Transactional
    fun fetchAndIngest(feedId: UUID) {
        val feed = feeds.findById(feedId).orElse(null) ?: return
        if (feed.sourceKind == SCRAPE_KIND) {
            scrapeAndIngest(feed)
            return
        }
        val meta = sync.meta(feedId)
        try {
            val result = fetcher.fetch(feed.xmlUrl, meta.first, meta.second)
            applyResult(feed, result.status, result.text, result.etag, result.lastModified)
        } catch (err: IllegalStateException) {
            sync.saveError(feedId, err.message ?: "error")
        } catch (err: IllegalArgumentException) {
            sync.saveError(feedId, err.message ?: "error")
        } catch (err: SAXException) {
            // Malformed feeds (SAXParseException and kin) must also land on
            // the sync row: an unrecorded failure leaves the feed perpetually
            // due and the exception would abort the poller's drain.
            sync.saveError(feedId, err.message ?: "error")
        }
    }

    /** A watched page: fetch HTML, then extract and store its item list. */
    @Transactional
    fun scrapeAndIngest(feed: FeedEntity) {
        val url = feed.pageUrl ?: feed.xmlUrl
        try {
            ingestScrapedHtml(feed, pages.fetchHtml(url))
        } catch (err: IllegalStateException) {
            sync.saveError(feed.id!!, err.message ?: "error")
        } catch (err: IllegalArgumentException) {
            sync.saveError(feed.id!!, err.message ?: "error")
        }
    }

    @Transactional
    fun ingestScrapedHtml(feed: FeedEntity, html: String) {
        val url = feed.pageUrl ?: feed.xmlUrl
        val doc = Jsoup.parse(html, url)
        val candidates = ScrapeExtraction.best(doc, feed.itemSelector).extract(doc, url).take(MAX_SCRAPE_ITEMS)
        ingestScrapedCandidates(feed, candidates)
    }

    @Transactional
    fun ingestScrapedCandidates(feed: FeedEntity, candidates: List<ScrapeCandidate>) {
        if (candidates.isEmpty()) {
            sync.saveError(feed.id!!, "No articles found on page")
            return
        }
        saveScrapedItems(feed, candidates)
        sync.saveOk(feed.id!!, null, null)
        feed.lastScrapeAt = Instant.now()
        feeds.save(feed)
    }

    private fun saveScrapedItems(feed: FeedEntity, candidates: List<ScrapeCandidate>) {
        val now = System.currentTimeMillis()
        val items = ScrapeExtraction.items(candidates, now)
        val links = items.mapNotNull { saveItem(feed, it) }
        if (links.isNotEmpty()) maintenance.updatePopularity(feed.id!!, links.toTypedArray())
        maintenance.updateLonelyHot(feed.id!!)
        maintenance.pruneFeed(feed.id!!, MAX_ARTICLES_PER_FEED)
        pending.applyForFeed(feed.id!!)
    }

    @Transactional
    fun ingestXml(feed: FeedEntity, xml: String) {
        val parsed = parseFeedXml(xml, System.currentTimeMillis())
        sync.maybeRename(feed, parsed.title)
        sync.maybeUpdateMeta(feed, parsed.siteUrl, parsed.icon)
        val links = parsed.items.mapNotNull { saveItem(feed, it) }
        if (links.isNotEmpty()) maintenance.updatePopularity(feed.id!!, links.toTypedArray())
        maintenance.updateLonelyHot(feed.id!!)
        maintenance.pruneFeed(feed.id!!, MAX_ARTICLES_PER_FEED)
        pending.applyForFeed(feed.id!!)
    }

    private fun applyResult(feed: FeedEntity, status: Int, text: String?, etag: String?, lastModified: String?) {
        if (status == NOT_MODIFIED) {
            sync.saveNotModified(feed.id!!, etag, lastModified)
            return
        }
        if (text == null) return
        ingestXml(feed, text)
        sync.saveOk(feed.id!!, etag, lastModified)
    }

    private fun saveItem(feed: FeedEntity, item: ParsedItem): String? {
        val html = truncatedHtml(item)
        val link = item.link
        val norm = link?.let { normalizeLink(it) }
        val entity = toEntity(feed, item, html, link, norm)
        val existing = articles.findByFeedIdAndGuid(feed.id!!, item.guid)
        // A poll that finds the same story with the same text must not rewrite
        // the row: that churns writes and can reset extracted article metadata.
        if (existing != null && existing.sameContent(entity)) return null
        // Full text is a one-time enrichment for new stories. A later poll
        // keeps the stored body and only refreshes list-level fields.
        if (existing == null) entity.contentHtml = ArticleFullText.of(pages, item, html)
        articles.save(entity)
        return norm
    }

    private fun truncatedHtml(item: ParsedItem): String {
        val raw = item.content ?: item.summary.orEmpty()
        var html = sanitizeHtml(raw)
        if (html.length > MAX_CONTENT_BYTES) html = html.take(MAX_CONTENT_BYTES)
        if (item.media != null && firstImageUrl(html, item.link) != item.media) {
            html = sanitizeHtml("""<img src="${item.media}" alt="">""") + html
        }
        return html
    }

    private fun toEntity(
        feed: FeedEntity,
        item: ParsedItem,
        html: String,
        link: String?,
        norm: String?,
    ): ArticleEntity {
        val engagement = contentEngagement(
            EngagementInput(item.title, html, item.summary, item.author, item.media),
        )
        return ArticleEntity(
            id = makeArticleId(feed.id!!.toString(), item.guid),
            feedId = feed.id!!,
            guid = item.guid,
            title = item.title.ifEmpty { "(untitled)" },
            link = link,
            normLink = norm,
            domain = link?.let { domainOf(it) }?.ifEmpty { null },
            author = item.author,
            summary = item.summary,
            contentHtml = html,
            comments = item.comments,
            publishedAt = Instant.ofEpochMilli(item.published),
            fetchedAt = Instant.now(),
            engagement = engagement.toFloat(),
        )
    }
}
