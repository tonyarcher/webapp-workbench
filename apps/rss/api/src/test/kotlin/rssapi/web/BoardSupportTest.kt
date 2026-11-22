package rssapi.web

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import rssapi.persist.ArticleEntity
import rssapi.persist.BoardEntity
import rssapi.persist.BoardEntryEntity
import rssapi.persist.BoardEntryRepo
import rssapi.persist.BoardRepo
import rssapi.persist.FeedEntity
import rssapi.persist.SubscriptionRepo
import rssapi.persist.UserEntity
import rssapi.persist.UserRepo
import java.time.Instant
import java.util.UUID

class BoardSupportTest {
    @Test
    fun requireBoardTitleBlankThrows() {
        assertThrows<ApiException> { requireBoardTitle("  ") }
    }

    @Test
    fun requireBoardTitleTrims() {
        assertEquals("hello", requireBoardTitle("  hello  "))
    }

    @Test
    fun boardIdInvalidThrows() {
        assertThrows<ApiException> { boardId("nope") }
    }

    @Test
    fun boardIdValid() {
        val id = UUID.randomUUID().toString()
        assertEquals(UUID.fromString(id), boardId(id))
    }

    @Test
    fun ownedBoardMissingThrows() {
        val boards = mock<BoardRepo>()
        whenever(boards.findByUserIdAndId(any(), any())).thenReturn(null)
        assertThrows<ApiException> { ownedBoard(boards, UUID.randomUUID(), UUID.randomUUID()) }
    }

    @Test
    fun snapshotOfMapsFields() {
        val article =
            ArticleEntity(
                id = "a1",
                feedId = UUID.randomUUID(),
                title = "T",
                author = "A",
                summary = "S",
                publishedAt = Instant.ofEpochMilli(5),
            )
        val feed = FeedEntity(id = article.feedId, title = "Feed")
        val boardId = UUID.randomUUID()
        val entry = snapshotOf(article, feed, boardId, 3, "<p>x</p>")
        assertEquals(boardId, entry.boardId)
        assertEquals("a1", entry.articleId)
        assertEquals("T", entry.title)
        assertEquals("A", entry.author)
        assertEquals("S", entry.summary)
        assertEquals("<p>x</p>", entry.contentHtml)
        assertEquals("Feed", entry.feedTitle)
        assertEquals(3, entry.sortOrder)
    }

    @Test
    fun nextEntrySortOrderEmpty() {
        val repo = mock<BoardEntryRepo>()
        whenever(repo.findFirstByBoardIdOrderBySortOrderDesc(any())).thenReturn(null)
        assertEquals(0, nextEntrySortOrder(repo, UUID.randomUUID()))
    }

    @Test
    fun nextEntrySortOrderIncrements() {
        val repo = mock<BoardEntryRepo>()
        val boardId = UUID.randomUUID()
        whenever(repo.findFirstByBoardIdOrderBySortOrderDesc(boardId)).thenReturn(
            BoardEntryEntity(boardId = boardId, articleId = "a", title = "t", sortOrder = 4, addedAt = Instant.now()),
        )
        assertEquals(5, nextEntrySortOrder(repo, boardId))
    }

    @Test
    fun rankBoardEntriesAllFields() {
        val boardId = UUID.randomUUID()
        val e = BoardEntryEntity(
            boardId = boardId,
            articleId = "a1",
            title = "batteries",
            author = "alice",
            summary = "lithium",
            note = "important",
            contentHtml = "<p>x</p>",
            link = "https://example.com/batteries",
            addedAt = Instant.now(),
            sortOrder = 0,
        )
        val ranked = rankBoardEntries(listOf(e), listOf("batteries", "alice", "lithium", "important", "example"))
        assertEquals("a1", ranked.first().articleId)
    }

    @Test
    fun rankBoardEntriesRanksByTitle() {
        val e1 =
            BoardEntryEntity(
                boardId = UUID.randomUUID(),
                articleId = "a1",
                title = "batteries",
                addedAt = Instant.now(),
                sortOrder = 0,
            )
        val e2 =
            BoardEntryEntity(
                boardId = e1.boardId,
                articleId = "a2",
                title = "solar",
                addedAt = Instant.now(),
                sortOrder = 1,
            )
        val ranked = rankBoardEntries(listOf(e1, e2), listOf("batteries"))
        assertEquals("a1", ranked.first().articleId)
    }

    @Test
    fun buildBoardOpmlSkipsMissingFeeds() {
        val boardId = UUID.randomUUID()
        val feedId = UUID.randomUUID()
        val rows = listOf(
            BoardEntryEntity(
                boardId = boardId,
                articleId = "a1",
                feedId = feedId,
                title = "T",
                addedAt = Instant.now(),
                sortOrder = 0,
            ),
            BoardEntryEntity(
                boardId = boardId,
                articleId = "a2",
                feedId = UUID.randomUUID(),
                title = "U",
                addedAt = Instant.now(),
                sortOrder = 1,
            ),
        )
        val feeds = mapOf(feedId to FeedEntity(id = feedId, xmlUrl = "https://f.example/rss", title = "Feed"))
        val xml = buildBoardOpml("My Board", rows, feeds)
        assertTrue(xml.contains("Feed") && xml.contains("My Board"))
    }

    @Test
    fun buildBoardOpmlEmpty() {
        val xml = buildBoardOpml("Empty", emptyList(), emptyMap())
        assertTrue(xml.contains("</opml>"))
    }

    @Test
    fun resolveSubscribedArticleFound() {
        val articles = mock<rssapi.persist.ArticleRepo>()
        val subs = mock<SubscriptionRepo>()
        val feedId = UUID.randomUUID()
        val uid = UUID.randomUUID()
        val article = ArticleEntity(id = "a1", feedId = feedId, title = "T", publishedAt = Instant.now())
        whenever(articles.findById("a1")).thenReturn(java.util.Optional.of(article))
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(feedId))
        assertEquals(article, resolveSubscribedArticle(articles, subs, uid, "a1"))
    }

    @Test
    fun resolveSubscribedArticleMissing() {
        val articles = mock<rssapi.persist.ArticleRepo>()
        val subs = mock<SubscriptionRepo>()
        whenever(articles.findById("a1")).thenReturn(java.util.Optional.empty())
        assertThrows<ApiException> { resolveSubscribedArticle(articles, subs, UUID.randomUUID(), "a1") }
    }

    @Test
    fun ownedBoardFound() {
        val boards = mock<BoardRepo>()
        val uid = UUID.randomUUID()
        val id = UUID.randomUUID()
        val board = BoardEntity(id = id, userId = uid, title = "B")
        whenever(boards.findByUserIdAndId(uid, id)).thenReturn(board)
        assertEquals(board, ownedBoard(boards, uid, id))
    }

    @Test
    fun resolveSubscribedArticleUnsubscribed() {
        val articles = mock<rssapi.persist.ArticleRepo>()
        val subs = mock<SubscriptionRepo>()
        val feedId = UUID.randomUUID()
        val uid = UUID.randomUUID()
        val article = ArticleEntity(id = "a1", feedId = feedId, title = "T", publishedAt = Instant.now())
        whenever(articles.findById("a1")).thenReturn(java.util.Optional.of(article))
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(UUID.randomUUID()))
        assertThrows<ApiException> { resolveSubscribedArticle(articles, subs, uid, "a1") }
    }
}
