package rssapi.ingest

import java.time.Instant
import java.util.UUID
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
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
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleMaintenanceRepo
import rssapi.persist.ArticleRepo
import rssapi.persist.FeedEntity
import rssapi.persist.FeedRepo

@Service
class IngestService(
    private val feeds: FeedRepo,
    private val articles: ArticleRepo,
    private val maintenance: ArticleMaintenanceRepo,
    private val sync: IngestSync,
    private val pending: PendingApply,
    private val fetcher: FeedFetcher,
) {
    @Transactional
    fun fetchAndIngest(feedId: UUID) {
        val feed = feeds.findById(feedId).orElse(null) ?: return
        val meta = sync.meta(feedId)
        try {
            val result = fetcher.fetch(feed.xmlUrl, meta.first, meta.second)
            applyResult(feed, result.status, result.text, result.etag, result.lastModified)
        } catch (err: IllegalStateException) {
            sync.saveError(feedId, err.message ?: "error")
        } catch (err: IllegalArgumentException) {
            sync.saveError(feedId, err.message ?: "error")
        }
    }

    @Transactional
    fun pollFeed(feedId: UUID) {
        fetchAndIngest(feedId)
    }

    @Transactional
    fun ingestXml(feed: FeedEntity, xml: String) {
        val parsed = parseFeedXml(xml, System.currentTimeMillis())
        sync.maybeRename(feed, parsed.title)
        val links = parsed.items.mapNotNull { saveItem(feed, it) }
        if (links.isNotEmpty()) maintenance.updatePopularity(links.toTypedArray())
        maintenance.updateLonelyHot(feed.id!!)
        maintenance.pruneFeed(feed.id!!, MAX_ARTICLES_PER_FEED)
        pending.applyForFeed(feed.id!!)
    }

    private fun applyResult(
        feed: FeedEntity,
        status: Int,
        text: String?,
        etag: String?,
        lastModified: String?,
    ) {
        if (status == 304) {
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
        articles.save(toEntity(feed, item, html, link, norm))
        return norm
    }

    private fun truncatedHtml(item: ParsedItem): String {
        val raw = item.content ?: item.summary.orEmpty()
        var html = sanitizeHtml(raw)
        if (html.length > MAX_CONTENT_BYTES) html = html.take(MAX_CONTENT_BYTES)
        if (item.media != null && firstImageUrl(html) != item.media) {
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
