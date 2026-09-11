package rssapi.ingest

import java.time.Instant
import java.util.UUID
import org.springframework.stereotype.Component
import rssapi.persist.FeedEntity
import rssapi.persist.FeedRepo
import rssapi.persist.FeedSyncEntity
import rssapi.persist.FeedSyncRepo

@Component
class IngestSync(
    private val feeds: FeedRepo,
    private val sync: FeedSyncRepo,
) {
    fun maybeRename(feed: FeedEntity, title: String) {
        if ((feed.title == "Untitled feed" || feed.title.isEmpty()) && title.isNotEmpty() && title != "Untitled feed") {
            feed.title = title
            feeds.save(feed)
        }
    }

    fun saveError(feedId: UUID, message: String) {
        val row = sync.findById(feedId).orElseGet { FeedSyncEntity(feedId = feedId) }
        row.lastFetchedAt = Instant.now()
        row.lastError = message
        sync.save(row)
    }

    fun saveOk(feedId: UUID, etag: String?, lastModified: String?) {
        val row = sync.findById(feedId).orElseGet { FeedSyncEntity(feedId = feedId) }
        row.lastFetchedAt = Instant.now()
        row.lastError = null
        if (etag != null) row.etag = etag
        if (lastModified != null) row.lastModified = lastModified
        sync.save(row)
    }

    fun saveNotModified(feedId: UUID, etag: String?, lastModified: String?) {
        val row = sync.findById(feedId).orElseGet { FeedSyncEntity(feedId = feedId) }
        row.lastFetchedAt = Instant.now()
        if (etag != null) row.etag = etag
        if (lastModified != null) row.lastModified = lastModified
        sync.save(row)
    }

    fun ensureRow(feedId: UUID) {
        if (!sync.existsById(feedId)) sync.save(FeedSyncEntity(feedId = feedId))
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
