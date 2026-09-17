package rssapi.web

import java.util.Optional
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import rssapi.ingest.IngestSync
import rssapi.persist.AffinityRepo
import rssapi.persist.FeedEntity
import rssapi.persist.FeedRepo
import rssapi.persist.FolderEntity
import rssapi.persist.FolderRepo
import rssapi.persist.PendingStateRepo
import rssapi.persist.SubscriptionRepo

class MigrateServiceTest {
    private val folders: FolderRepo = mock()
    private val feeds: FeedRepo = mock()
    private val pending: PendingStateRepo = mock()
    private val affinity: AffinityRepo = mock()
    private val sync: IngestSync = mock()
    private val subs: SubscriptionRepo = mock()
    private val memberships: MembershipService = mock()
    private val service = MigrateService(folders, feeds, pending, affinity, sync, subs, memberships)
    private val userId = UUID.randomUUID()

    @Test
    fun emptyBodyMigratesNothing() {
        val result = service.run(userId, MigrateBody())
        assertEquals(0, result.feedsAdded)
        assertEquals(0, result.foldersAdded)
        assertEquals(0, result.statesQueued)
    }

    @Test
    fun foldersFeedsStates() {
        val folderId = UUID.randomUUID()
        val feedId = UUID.randomUUID()
        stubFolders(folderId)
        stubFeeds(feedId)
        whenever(subs.existsByUserIdAndFeedId(userId, feedId)).thenReturn(false)
        val body = MigrateBody(
            folders = listOf(MigrateFolder("News")),
            feeds = listOf(MigrateFeed(url = "https://example.com/rss", folderTitles = listOf("News"))),
            states = listOf(MigrateState(feedUrl = "https://example.com/rss", guid = "g1", read = true)),
            affinity = listOf(MigrateAffinity("aff:feed:x", 1.0)),
        )
        val result = service.run(userId, body)
        assertEquals(1, result.feedsAdded)
        assertEquals(1, result.foldersAdded)
        assertEquals(1, result.statesQueued)
    }

    private fun stubFolders(folderId: UUID) {
        whenever(folders.findByUserIdAndTitle(userId, "News")).thenReturn(null)
        whenever(folders.save(any())).thenAnswer {
            val e = it.getArgument<FolderEntity>(0)
            e.id = folderId
            e
        }
    }

    private fun stubFeeds(feedId: UUID) {
        whenever(feeds.findByXmlUrl("https://example.com/rss")).thenReturn(null)
        whenever(feeds.save(any())).thenAnswer {
            val e = it.getArgument<FeedEntity>(0)
            e.id = feedId
            e
        }
    }

    @Test
    fun unknownFeedUrlSkipsState() {
        val body = MigrateBody(states = listOf(MigrateState(feedUrl = "https://missing.test/rss")))
        val result = service.run(userId, body)
        assertEquals(0, result.statesQueued)
    }

    @Test
    fun unknownFolderSkipped() {
        val feedId = UUID.randomUUID()
        stubFeeds(feedId)
        whenever(subs.existsByUserIdAndFeedId(userId, feedId)).thenReturn(false)
        val body = MigrateBody(
            feeds = listOf(MigrateFeed(url = "https://example.com/rss", folderTitles = listOf("Ghost"))),
            states = listOf(
                MigrateState(
                    feedUrl = "https://example.com/rss",
                    guid = "g1",
                    link = "https://example.com/1",
                    read = true,
                    readAt = 1_700_000_000_000L,
                    starred = true,
                ),
            ),
            affinity = listOf(MigrateAffinity("k", 1.0), MigrateAffinity("k2", 2.0)),
        )
        val result = service.run(userId, body)
        assertEquals(1, result.feedsAdded)
        assertEquals(0, result.foldersAdded)
        assertEquals(1, result.statesQueued)
    }

    @Test
    fun existingRowsReused() {
        val folderId = UUID.randomUUID()
        val feedId = UUID.randomUUID()
        whenever(folders.findByUserIdAndTitle(userId, "N")).thenReturn(
            FolderEntity(id = folderId, userId = userId, title = "N"),
        )
        whenever(feeds.findByXmlUrl("https://example.com/rss")).thenReturn(
            FeedEntity(id = feedId, xmlUrl = "https://example.com/rss", title = "t"),
        )
        whenever(subs.existsByUserIdAndFeedId(userId, feedId)).thenReturn(true)
        whenever(sync.ensureRow(feedId)).thenAnswer { }
        val body = MigrateBody(
            folders = listOf(MigrateFolder("N")),
            feeds = listOf(MigrateFeed(url = "https://example.com/rss")),
        )
        val result = service.run(userId, body)
        assertEquals(1, result.feedsAdded)
        assertEquals(1, result.foldersAdded)
    }
}
