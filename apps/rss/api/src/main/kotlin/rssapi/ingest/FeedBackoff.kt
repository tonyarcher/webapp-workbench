package rssapi.ingest

import org.springframework.stereotype.Component
import rssapi.persist.FeedSyncRepo
import java.util.UUID

/** Small helper for reader-forced refreshes that must ignore the retry delay. */
@Component
class FeedBackoff(private val sync: FeedSyncRepo) {
    fun clear(feedId: UUID) {
        val row = sync.findById(feedId).orElse(null) ?: return
        row.nextAttemptAt = null
        sync.save(row)
    }
}
