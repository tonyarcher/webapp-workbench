package rssapi.web

import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import rssapi.ingest.IngestSync
import rssapi.persist.FeedEntity
import rssapi.persist.FeedRepo
import rssapi.persist.FolderEntity
import rssapi.persist.FolderFeedRepo
import rssapi.persist.FolderRepo
import rssapi.persist.SubscriptionRepo
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class OpmlImportServiceBranchTest {
    private val folders: FolderRepo = mock()
    private val feeds: FeedRepo = mock()
    private val memberships: FolderFeedRepo = mock()
    private val sync: IngestSync = mock()
    private val subs: SubscriptionRepo = mock()
    private val service = OpmlImportService(folders, feeds, memberships, sync, subs)
    private val userId = UUID.randomUUID()

    private fun opml(vararg outlines: String): String =
        """<opml version="2.0"><body>${outlines.joinToString("")}</body></opml>"""

    private fun stubEmpty() {
        whenever(folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(userId)).thenReturn(emptyList())
        whenever(folders.saveAll(any<List<FolderEntity>>())).thenAnswer { inv ->
            inv.getArgument<List<FolderEntity>>(0).onEach { if (it.id == null) it.id = UUID.randomUUID() }
        }
        whenever(feeds.findByXmlUrlIn(any<Set<String>>())).thenReturn(emptyList())
        whenever(feeds.saveAll(any<List<FeedEntity>>())).thenAnswer { inv ->
            inv.getArgument<List<FeedEntity>>(0).onEach { if (it.id == null) it.id = UUID.randomUUID() }
        }
        whenever(subs.findFeedIdsByUserId(userId)).thenReturn(emptyList())
        whenever(memberships.findByFolderIdIn(any<List<UUID>>())).thenReturn(emptyList())
    }

    @Test
    fun emptyBody() {
        stubEmpty()
        val res = service.run(userId, opml())
        assertEquals(0, res.addedFeeds)
        assertEquals(0, res.addedFolders)
    }

    @Test
    fun invalidUrlsSkipped() {
        stubEmpty()
        val res = service.run(
            userId,
            opml("""<outline type="rss" text="Bad" xmlUrl="javascript:alert(1)"/>"""),
        )
        assertEquals(0, res.addedFeeds)
        assertEquals(1, res.skippedFeeds)
    }

    @Test
    fun duplicateMergesFolders() {
        stubEmpty()
        val res = service.run(
            userId,
            opml(
                """<outline text="Tech"><outline type="rss" text="A" xmlUrl="https://a.example/rss"/></outline>""",
                """<outline text="News"><outline type="rss" text="A" xmlUrl="https://a.example/rss"/></outline>""",
            ),
        )
        assertEquals(1, res.addedFeeds)
        assertEquals(2, res.addedFolders)
        assertEquals(0, res.skippedFeeds)
    }

    @Test
    fun existingRowsReused() {
        val folderId = UUID.randomUUID()
        val feedId = UUID.randomUUID()
        whenever(folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(userId)).thenReturn(
            listOf(FolderEntity(id = folderId, userId = userId, title = "Tech", sortOrder = 0)),
        )
        whenever(feeds.findByXmlUrlIn(setOf("https://a.example/rss"))).thenReturn(
            listOf(FeedEntity(id = feedId, xmlUrl = "https://a.example/rss", title = "A")),
        )
        whenever(subs.findFeedIdsByUserId(userId)).thenReturn(listOf(feedId))
        whenever(memberships.findByFolderIdIn(listOf(folderId))).thenReturn(
            listOf(rssapi.persist.FolderFeedEntity(folderId = folderId, feedId = feedId)),
        )
        val res = service.run(
            userId,
            opml("""<outline text="Tech"><outline type="rss" text="A" xmlUrl="https://a.example/rss"/></outline>"""),
        )
        assertEquals(0, res.addedFeeds)
        assertEquals(0, res.addedFolders)
        assertEquals(0, res.subscribedFeeds)
        assertEquals(listOf(folderId.toString()), res.feeds[0].folderIds)
    }

    @Test
    fun untitledDefaults() {
        stubEmpty()
        val res = service.run(
            userId,
            opml("""<outline type="rss" xmlUrl="https://example.com/rss"/>"""),
        )
        assertEquals(1, res.addedFeeds)
        assertEquals("Untitled", res.feeds[0].title)
    }

    @Test
    fun nestedFolders() {
        stubEmpty()
        val res = service.run(
            userId,
            opml(
                """<outline text="Outer"><outline text="Inner">""" +
                    """<outline type="rss" text="A" xmlUrl="https://a.example/rss"/>""" +
                    """</outline></outline>""",
            ),
        )
        assertEquals(1, res.addedFeeds)
        assertEquals(2, res.addedFolders)
    }

    @Test
    fun blankFolderTitleSkipped() {
        stubEmpty()
        val res = service.run(
            userId,
            opml(
                """<outline text="   "><outline type="rss" text="A" xmlUrl="https://a.example/rss"/></outline>""",
            ),
        )
        assertEquals(1, res.addedFeeds)
        assertEquals(0, res.addedFolders)
    }

    @Test
    fun unsavedIdsSkipped() {
        whenever(folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(userId)).thenReturn(emptyList())
        whenever(folders.saveAll(any<List<FolderEntity>>())).thenAnswer { inv ->
            inv.getArgument<List<FolderEntity>>(0)
        }
        whenever(feeds.findByXmlUrlIn(any<Set<String>>())).thenReturn(emptyList())
        whenever(feeds.saveAll(any<List<FeedEntity>>())).thenAnswer { inv ->
            inv.getArgument<List<FeedEntity>>(0)
        }
        whenever(subs.findFeedIdsByUserId(userId)).thenReturn(emptyList())
        whenever(memberships.findByFolderIdIn(any<List<UUID>>())).thenReturn(emptyList())
        val res = service.run(
            userId,
            opml(
                """<outline text="Tech"><outline type="rss" text="A" xmlUrl="https://a.example/rss"/></outline>""",
            ),
        )
        assertEquals(1, res.addedFeeds)
        assertEquals(1, res.addedFolders)
        assertEquals(0, res.subscribedFeeds)
        assertEquals("https://a.example/rss", res.feeds[0].url)
        assertTrue(res.feeds[0].folderIds.isEmpty())
    }

    @Test
    fun otherFoldersFiltered() {
        val otherId = UUID.randomUUID()
        whenever(folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(userId)).thenReturn(
            listOf(FolderEntity(id = otherId, userId = userId, title = "Other", sortOrder = 0)),
        )
        whenever(folders.saveAll(any<List<FolderEntity>>())).thenAnswer { inv ->
            inv.getArgument<List<FolderEntity>>(0).onEach { if (it.id == null) it.id = UUID.randomUUID() }
        }
        whenever(feeds.findByXmlUrlIn(any<Set<String>>())).thenReturn(emptyList())
        whenever(feeds.saveAll(any<List<FeedEntity>>())).thenAnswer { inv ->
            inv.getArgument<List<FeedEntity>>(0).onEach { if (it.id == null) it.id = UUID.randomUUID() }
        }
        whenever(subs.findFeedIdsByUserId(userId)).thenReturn(emptyList())
        whenever(memberships.findByFolderIdIn(any<List<UUID>>())).thenReturn(emptyList())
        val res = service.run(
            userId,
            opml(
                """<outline text="Tech"><outline type="rss" text="A" xmlUrl="https://a.example/rss"/></outline>""",
            ),
        )
        assertEquals(1, res.addedFolders)
        assertEquals(1, res.folders.size)
        assertEquals("Tech", res.folders[0].title)
    }

    @Test
    fun mixedSavedIds() {
        whenever(folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(userId)).thenReturn(emptyList())
        whenever(folders.saveAll(any<List<FolderEntity>>())).thenAnswer { inv ->
            inv.getArgument<List<FolderEntity>>(0)
        }
        whenever(feeds.findByXmlUrlIn(any<Set<String>>())).thenReturn(emptyList())
        whenever(feeds.saveAll(any<List<FeedEntity>>())).thenAnswer { inv ->
            inv.getArgument<List<FeedEntity>>(0).onEach { if (it.id == null) it.id = UUID.randomUUID() }
        }
        whenever(subs.findFeedIdsByUserId(userId)).thenReturn(emptyList())
        whenever(memberships.findByFolderIdIn(any<List<UUID>>())).thenReturn(emptyList())
        val res = service.run(
            userId,
            opml(
                """<outline text="Tech"><outline type="rss" text="A" xmlUrl="https://a.example/rss"/></outline>""",
            ),
        )
        assertEquals(1, res.addedFeeds)
        assertEquals(1, res.addedFolders)
        assertTrue(res.feeds[0].folderIds.isEmpty())
    }
}
