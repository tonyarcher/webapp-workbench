package rssapi.connectors
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import rssapi.feeds.FeedEntity
import rssapi.feeds.FeedRepo
import rssapi.feeds.FeedSyncEntity
import rssapi.feeds.FeedSyncRepo
import rssapi.feeds.SubscriptionRepo
import rssapi.platform.ApiException
import java.time.Instant
import java.util.Optional
import java.util.UUID

class SourceInfoServiceTest {
    private val feeds: FeedRepo = mock()
    private val subs: SubscriptionRepo = mock()
    private val syncRows: FeedSyncRepo = mock()
    private val registry: ConnectorRegistry = mock()
    private val service = SourceInfoService(feeds, subs, syncRows, registry)
    private val uid = UUID.randomUUID()
    private val fid = UUID.randomUUID()

    @Test
    fun reportsRegisteredConnectorAndPollBookkeeping() {
        val feed = FeedEntity(id = fid, sourceKind = "rss", connectorId = "rss", connectorVersion = "1")
        val ran = Instant.parse("2026-11-22T10:00:00Z")
        whenever(feeds.findById(fid)).thenReturn(Optional.of(feed))
        whenever(subs.existsByUserIdAndFeedId(uid, fid)).thenReturn(true)
        whenever(syncRows.findById(fid)).thenReturn(
            Optional.of(FeedSyncEntity(feedId = fid, lastFetchedAt = ran, lastError = "boom")),
        )
        whenever(registry.getOrNull("rss")).thenReturn(
            object : Connector {
                override val id = "rss"
                override val version = "1"
                override val capabilities = ConnectorCapabilities(supportsIncremental = true)
                override fun source(feed: FeedEntity) =
                    ConnectorSource(fid.toString(), "rss", "rss", null, null, "poll")
                override fun fetch(source: ConnectorSource): List<ConnectorItem> = emptyList()
            },
        )

        val info = service.info(uid, fid.toString())

        assertEquals("rss", info.connectorId)
        assertEquals(ran, info.lastRunAt)
        assertEquals("boom", info.lastError)
        assertEquals(true, info.capabilities.supportsIncremental)
    }

    @Test
    fun unknownConnectorFallsBackToBestEffort() {
        val feed = FeedEntity(id = fid, sourceKind = "scrape")
        whenever(feeds.findById(fid)).thenReturn(Optional.of(feed))
        whenever(subs.existsByUserIdAndFeedId(uid, fid)).thenReturn(true)
        whenever(syncRows.findById(fid)).thenReturn(Optional.empty())
        whenever(registry.getOrNull("scrape")).thenReturn(null)

        val info = service.info(uid, fid.toString())

        assertEquals("scrape", info.connectorId)
        assertNull(info.lastRunAt)
        assertNull(info.lastError)
        assertEquals(true, info.capabilities.bestEffort)
    }

    @Test
    fun unknownFeedIs404() {
        whenever(feeds.findById(any())).thenReturn(Optional.empty())
        assertThrows<ApiException> { service.info(uid, fid.toString()) }
    }

    @Test
    fun unownedFeedIs404() {
        val feed = FeedEntity(id = fid, sourceKind = "rss")
        whenever(feeds.findById(fid)).thenReturn(Optional.of(feed))
        whenever(subs.existsByUserIdAndFeedId(uid, fid)).thenReturn(false)
        assertThrows<ApiException> { service.info(uid, fid.toString()) }
    }

    @Test
    fun malformedIdIs404() {
        assertThrows<ApiException> { service.info(uid, "not-a-uuid") }
    }
}
