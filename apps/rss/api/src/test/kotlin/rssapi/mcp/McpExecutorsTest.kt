package rssapi.mcp
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import rssapi.ai.AiHighlightService
import rssapi.ai.HighlightExcerpt
import rssapi.ai.HighlightResult
import rssapi.articles.ArticleEntity
import rssapi.articles.ArticleListQuery
import rssapi.articles.ArticleRepo
import rssapi.articles.ArticleStateEntity
import rssapi.articles.ArticleStateId
import rssapi.articles.ArticleStateRepo
import rssapi.boards.BoardEntity
import rssapi.boards.BoardEntryRepo
import rssapi.boards.BoardRepo
import rssapi.boards.SavedArticleRepo
import rssapi.feeds.FeedEntity
import rssapi.feeds.FeedRepo
import rssapi.feeds.LibraryService
import rssapi.feeds.SubscriptionRepo
import rssapi.storage.BodyStore
import java.time.Instant
import java.util.Optional
import java.util.UUID

private val EXEC_UID: UUID = UUID.fromString("66666666-6666-6666-6666-666666666666")
private val EXEC_FID: UUID = UUID.fromString("77777777-7777-7777-7777-777777777777")

class McpExecutorsTest {
    private fun article(): ArticleEntity = ArticleEntity(
        id = "a1",
        feedId = EXEC_FID,
        guid = "g1",
        title = "A story",
        summary = "summary",
        excerpt = "excerpt",
        link = "https://example.com/a1",
        publishedAt = Instant.parse("2026-11-22T10:00:00Z"),
    )

    @Test
    fun libraryToolsReturnLists() {
        val library: LibraryService = mock()
        whenever(library.feeds(EXEC_UID)).thenReturn(emptyList())
        whenever(library.folders(EXEC_UID)).thenReturn(emptyList())

        val tools = McpLibraryTools(library)

        assertEquals(emptyList<Any>(), (tools.feeds(EXEC_UID) as Map<*, *>)["feeds"])
        assertEquals(emptyList<Any>(), (tools.folders(EXEC_UID) as Map<*, *>)["folders"])
    }

    @Test
    fun summaryAndBodyUseSubscribedArticle() {
        val articles: ArticleRepo = mock()
        val subs: SubscriptionRepo = mock()
        val bodies: BodyStore = mock()
        val highlights: AiHighlightService = mock()
        whenever(articles.findById("a1")).thenReturn(Optional.of(article()))
        whenever(subs.existsByUserIdAndFeedId(EXEC_UID, EXEC_FID)).thenReturn(true)
        whenever(bodies.get("a1")).thenReturn("<p>body</p>")
        val tools = McpArticleTools(mock(), articles, subs, bodies, highlights)

        assertEquals("A story", (tools.summary(EXEC_UID, "a1") as Map<*, *>)["title"])
        assertEquals("<p>body</p>", (tools.body(EXEC_UID, "a1") as Map<*, *>)["content"])
    }

    @Test
    fun quoteCarriesProvenance() {
        val articles: ArticleRepo = mock()
        val subs: SubscriptionRepo = mock()
        val bodies: BodyStore = mock()
        val highlights: AiHighlightService = mock()
        whenever(articles.findById("a1")).thenReturn(Optional.of(article()))
        whenever(subs.existsByUserIdAndFeedId(EXEC_UID, EXEC_FID)).thenReturn(true)
        whenever(highlights.highlights(any(), any(), anyOrNull(), any<Int>())).thenReturn(
            HighlightResult(true, listOf(HighlightExcerpt(1, "verbatim", 0.9))),
        )
        val tools = McpArticleTools(mock(), articles, subs, bodies, highlights)

        val result = tools.quote(EXEC_UID, "a1") as Map<*, *>

        assertEquals("https://example.com/a1", result["link"])
        assertEquals("verbatim", ((result["excerpts"] as List<*>)[0] as Map<*, *>)["text"])
    }

    @Test
    fun writeToolsSaveSnapshotAndState() {
        val articles: ArticleRepo = mock()
        val subs: SubscriptionRepo = mock()
        val states: ArticleStateRepo = mock()
        val saved: SavedArticleRepo = mock()
        val boards: BoardRepo = mock()
        val entries: BoardEntryRepo = mock()
        val feeds: FeedRepo = mock()
        val bodies: BodyStore = mock()
        val board = BoardEntity(id = UUID.randomUUID(), userId = EXEC_UID, title = "Desk")
        whenever(articles.findById("a1")).thenReturn(Optional.of(article()))
        whenever(subs.existsByUserIdAndFeedId(EXEC_UID, EXEC_FID)).thenReturn(true)
        whenever(states.findById(ArticleStateId(EXEC_UID, "a1"))).thenReturn(Optional.empty())
        whenever(boards.findByUserIdAndId(EXEC_UID, board.id!!)).thenReturn(board)
        whenever(feeds.findById(EXEC_FID)).thenReturn(Optional.of(mock<FeedEntity>()))
        val tools = McpWriteTools(articles, subs, states, saved, boards, entries, feeds, bodies)

        assertEquals("starred", (tools.star(EXEC_UID, "a1") as Map<*, *>)["status"])
        assertEquals("saved", (tools.save(EXEC_UID, "a1") as Map<*, *>)["status"])
        assertEquals("pinned", (tools.board(EXEC_UID, "a1", board.id.toString()) as Map<*, *>)["status"])
        verify(states).save(any<ArticleStateEntity>())
    }

    @Test
    fun duplicateWritesAndInvalidBoardId() {
        val articles: ArticleRepo = mock()
        val subs: SubscriptionRepo = mock()
        val saved: SavedArticleRepo = mock()
        val boards: BoardRepo = mock()
        val entries: BoardEntryRepo = mock()
        val boardId = UUID.randomUUID()
        whenever(articles.findById("a1")).thenReturn(Optional.of(article()))
        whenever(subs.existsByUserIdAndFeedId(EXEC_UID, EXEC_FID)).thenReturn(true)
        whenever(saved.existsByUserIdAndArticleId(EXEC_UID, "a1")).thenReturn(true)
        whenever(boards.findByUserIdAndId(EXEC_UID, boardId)).thenReturn(
            BoardEntity(id = boardId, userId = EXEC_UID, title = "Desk"),
        )
        whenever(entries.findByBoardIdAndArticleId(boardId, "a1")).thenReturn(mock())
        val tools = McpWriteTools(articles, subs, mock(), saved, boards, entries, mock(), mock())

        assertEquals("already_saved", (tools.save(EXEC_UID, "a1") as Map<*, *>)["status"])
        assertEquals("already_pinned", (tools.board(EXEC_UID, "a1", boardId.toString()) as Map<*, *>)["status"])
        assertThrows<rssapi.platform.ApiException> { tools.board(EXEC_UID, "a1", "not-a-uuid") }
    }

    @Test
    fun unownedArticleIsRejected() {
        val articles: ArticleRepo = mock()
        val subs: SubscriptionRepo = mock()
        whenever(articles.findById("a1")).thenReturn(Optional.of(article()))
        val tools = McpArticleTools(mock(), articles, subs, mock(), mock())

        assertThrows<rssapi.platform.ApiException> { tools.summary(EXEC_UID, "a1") }
    }
}
