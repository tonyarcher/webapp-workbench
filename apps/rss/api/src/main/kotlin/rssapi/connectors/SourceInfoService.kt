package rssapi.connectors
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import rssapi.feeds.FeedRepo
import rssapi.feeds.FeedSyncRepo
import rssapi.feeds.SubscriptionRepo
import rssapi.platform.ApiException
import java.util.UUID

/**
 * Builds the source-info view from the feed, its registered connector, and the
 * existing poll bookkeeping on `feed_sync`.
 *
 * Last-run time and last error are read from the sync row rather than copied
 * onto `feeds`: the poller already writes them once per attempt, and a second
 * copy would double the per-poll write for every feed in the global pool.
 */
@Service
class SourceInfoService(
    private val feeds: FeedRepo,
    private val subs: SubscriptionRepo,
    private val syncRows: FeedSyncRepo,
    private val registry: ConnectorRegistry,
) {
    fun info(userId: UUID, feedId: String): SourceInfo {
        val id = parseUuid(feedId)
        val feed = feeds.findById(id).orElseThrow { notFound() }
        if (!subs.existsByUserIdAndFeedId(userId, feed.id!!)) throw notFound()
        val connectorId = feed.connectorId ?: feed.sourceKind
        val sync = syncRows.findById(id).orElse(null)
        return SourceInfo(
            feedId = feed.id!!.toString(),
            connectorId = connectorId,
            connectorVersion = feed.connectorVersion,
            sourceKind = feed.sourceKind,
            lastRunAt = sync?.lastFetchedAt,
            lastError = sync?.lastError,
            capabilities = registry.getOrNull(connectorId)?.capabilities
                ?: ConnectorCapabilities(bestEffort = true),
        )
    }

    private fun parseUuid(raw: String): UUID = try {
        UUID.fromString(raw.trim())
    } catch (_: IllegalArgumentException) {
        throw notFound()
    }

    private fun notFound() = ApiException(HttpStatus.NOT_FOUND, "Feed not found")
}
