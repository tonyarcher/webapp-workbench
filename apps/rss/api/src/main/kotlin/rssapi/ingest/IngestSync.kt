package rssapi.ingest
import org.springframework.stereotype.Component
import rssapi.feeds.FeedEntity
import rssapi.feeds.FeedRepo
import rssapi.feeds.FeedSyncEntity
import rssapi.feeds.FeedSyncRepo
import rssapi.poller.PollingBackoff
import java.time.Instant
import java.util.UUID

@Component
class IngestSync(private val feeds: FeedRepo, private val sync: FeedSyncRepo) {
    fun maybeRename(feed: FeedEntity, title: String) {
        if (!shouldRename(feed.title, title)) return
        feed.title = title
        feeds.save(feed)
    }

    fun maybeUpdateMeta(feed: FeedEntity, siteUrl: String?, icon: String?) {
        var changed = false
        if (siteUrl != null && feed.siteUrl != siteUrl) {
            feed.siteUrl = siteUrl
            changed = true
        }
        if (icon != null && feed.icon != icon) {
            feed.icon = icon
            changed = true
        }
        if (changed) feeds.save(feed)
    }

    private fun shouldRename(current: String, title: String): Boolean {
        if (title.isEmpty() || title == "Untitled feed") return false
        return current == "Untitled feed" || current.isEmpty()
    }

    fun saveError(feedId: UUID, message: String) {
        val row = sync.findById(feedId).orElseGet { FeedSyncEntity(feedId = feedId) }
        row.lastFetchedAt = Instant.now()
        row.lastError = message
        row.consecutiveFailures += 1
        row.nextAttemptAt = PollingBackoff.nextAttempt(row.consecutiveFailures, Instant.now())
        sync.save(row)
    }

    fun saveOk(feedId: UUID, etag: String?, lastModified: String?) {
        val row = sync.findById(feedId).orElseGet { FeedSyncEntity(feedId = feedId) }
        row.lastFetchedAt = Instant.now()
        row.lastError = null
        row.consecutiveFailures = 0
        row.nextAttemptAt = null
        if (etag != null) row.etag = etag
        if (lastModified != null) row.lastModified = lastModified
        sync.save(row)
    }

    fun saveNotModified(feedId: UUID, etag: String?, lastModified: String?) {
        val row = sync.findById(feedId).orElseGet { FeedSyncEntity(feedId = feedId) }
        row.lastFetchedAt = Instant.now()
        row.lastError = null
        row.consecutiveFailures = 0
        row.nextAttemptAt = null
        if (etag != null) row.etag = etag
        if (lastModified != null) row.lastModified = lastModified
        sync.save(row)
    }

    fun ensureRow(feedId: UUID) {
        if (!sync.existsById(feedId)) sync.save(FeedSyncEntity(feedId = feedId))
    }

    fun ensureRows(feedIds: List<UUID>) {
        if (feedIds.isEmpty()) return
        val have = sync.findAllById(feedIds).mapNotNull { it.feedId }.toSet()
        val missing = feedIds.filter { it !in have }.map { FeedSyncEntity(feedId = it) }
        if (missing.isNotEmpty()) sync.saveAll(missing)
    }

    fun meta(feedId: UUID): Pair<String?, String?> {
        val row = sync.findById(feedId).orElse(null) ?: return null to null
        return row.etag to row.lastModified
    }

    fun clearFetched(feedId: UUID) {
        val row = sync.findById(feedId).orElse(null) ?: return
        row.lastFetchedAt = null
        sync.save(row)
    }
}
