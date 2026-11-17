package rssapi.web

import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleRepo
import rssapi.persist.BoardEntity
import rssapi.persist.BoardEntryEntity
import rssapi.persist.BoardEntryRepo
import rssapi.persist.BoardRepo
import rssapi.persist.FeedEntity
import rssapi.persist.FeedRepo
import rssapi.persist.SubscriptionRepo
import rssapi.persist.UserEntity
import rssapi.persist.UserRepo
import java.time.Instant
import java.util.Optional
import java.util.UUID

private fun boardJwt(sub: String): Jwt = Jwt.withTokenValue("tok")
    .header("alg", "RS256")
    .claim("sub", sub)
    .claim("preferred_username", "alice")
    .claim("aud", listOf("rss-reader"))
    .build()

@WebMvcTest(BoardController::class, BoardEntryController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, IdentityUser::class)
class BoardControllerTest {
    @Autowired lateinit var mvc: MockMvc

    @MockitoBean lateinit var decoder: JwtDecoder

    @MockitoBean lateinit var users: UserRepo

    @MockitoBean lateinit var boards: BoardRepo

    @MockitoBean lateinit var entries: BoardEntryRepo

    @MockitoBean lateinit var articles: ArticleRepo

    @MockitoBean lateinit var feeds: FeedRepo

    @MockitoBean lateinit var subs: SubscriptionRepo

    private val uid = UUID.randomUUID()
    private val boardId = UUID.randomUUID()
    private val feedId = UUID.randomUUID()

    private fun auth() {
        whenever(decoder.decode(any())).thenReturn(boardJwt("u1"))
        whenever(users.findBySubject("u1")).thenReturn(
            UserEntity(id = uid, label = "identity", subject = "u1", username = "alice"),
        )
    }

    private fun board(title: String = "B"): BoardEntity = BoardEntity(id = boardId, userId = uid, title = title)

    private fun ownedBoard() {
        whenever(boards.findByUserIdAndId(uid, boardId)).thenReturn(board())
    }

    @Test
    fun listBoards() {
        auth()
        whenever(boards.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid)).thenReturn(listOf(board()))
        mvc.get("/boards") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
        }
            .andExpect {
                status { isOk() }
                jsonPath("$.items[0].title") { value("B") }
            }
    }

    @Test
    fun createBoardDedupes() {
        auth()
        whenever(boards.findByUserIdAndTitle(uid, "B")).thenReturn(board())
        mvc.post("/boards") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"title":"B"}"""
        }.andExpect {
            status { isOk() }
            jsonPath("$.title") { value("B") }
        }
        verify(boards, never()).save(any())
    }

    @Test
    fun createBoardRequiresTitle() {
        auth()
        mvc.post("/boards") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"title":"  "}"""
        }.andExpect { status { isBadRequest() } }
    }

    @Test
    fun renameBoard() {
        auth()
        ownedBoard()
        whenever(boards.save(any<BoardEntity>())).thenAnswer { it.arguments[0] }
        mvc.put("/boards/$boardId") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"title":"Renamed"}"""
        }.andExpect {
            status { isOk() }
            jsonPath("$.title") { value("Renamed") }
        }
    }

    @Test
    fun deleteBoard() {
        auth()
        ownedBoard()
        mvc.delete("/boards/$boardId") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
        }
            .andExpect { status { isOk() } }
        verify(boards).delete(any<BoardEntity>())
    }

    @Test
    fun reorderBoards() {
        auth()
        whenever(boards.findAllById(listOf(boardId))).thenReturn(listOf(board()))
        whenever(boards.saveAll(any<List<BoardEntity>>())).thenAnswer { it.arguments[0] }
        mvc.post("/boards/reorder") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"ids":["$boardId"]}"""
        }.andExpect { status { isOk() } }
    }

    @Test
    fun listEntries() {
        auth()
        ownedBoard()
        whenever(entries.findByBoardIdOrderBySortOrderAscAddedAtAsc(boardId)).thenReturn(
            listOf(
                BoardEntryEntity(
                    id = UUID.randomUUID(),
                    boardId = boardId,
                    articleId = "a1",
                    title = "T",
                    addedAt = Instant.ofEpochMilli(1000),
                    sortOrder = 0,
                ),
            ),
        )
        mvc.get("/boards/$boardId/entries") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
        }
            .andExpect {
                status { isOk() }
                jsonPath("$.items[0].title") { value("T") }
            }
    }

    @Test
    fun addEntryIdempotent() {
        auth()
        ownedBoard()
        val existing =
            BoardEntryEntity(
                id = UUID.randomUUID(),
                boardId = boardId,
                articleId = "a1",
                title = "T",
                addedAt = Instant.ofEpochMilli(1000),
                sortOrder = 0,
            )
        whenever(entries.findByBoardIdAndArticleId(boardId, "a1")).thenReturn(existing)
        mvc.post("/boards/$boardId/entries") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"articleId":"a1"}"""
        }.andExpect {
            status { isOk() }
            jsonPath("$.articleId") { value("a1") }
        }
    }

    @Test
    fun removeEntry() {
        auth()
        ownedBoard()
        mvc.delete("/boards/$boardId/entries/a1") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
        }
            .andExpect { status { isOk() } }
        verify(entries).deleteByBoardIdAndArticleId(boardId, "a1")
    }

    @Test
    fun noteEntry() {
        auth()
        ownedBoard()
        val row =
            BoardEntryEntity(
                id = UUID.randomUUID(),
                boardId = boardId,
                articleId = "a1",
                title = "T",
                note = "",
                addedAt = Instant.ofEpochMilli(1000),
                sortOrder = 0,
            )
        whenever(entries.findByBoardIdAndArticleId(boardId, "a1")).thenReturn(row)
        whenever(entries.save(any<BoardEntryEntity>())).thenAnswer { it.arguments[0] }
        mvc.put("/boards/$boardId/entries/a1") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"note":"hello"}"""
        }.andExpect {
            status { isOk() }
            jsonPath("$.note") { value("hello") }
        }
    }

    @Test
    fun searchEntries() {
        auth()
        ownedBoard()
        whenever(entries.findByBoardIdOrderBySortOrderAscAddedAtAsc(boardId)).thenReturn(
            listOf(
                BoardEntryEntity(
                    id = UUID.randomUUID(),
                    boardId = boardId,
                    articleId = "a1",
                    title = "Batteries",
                    addedAt = Instant.ofEpochMilli(1000),
                    sortOrder = 0,
                ),
            ),
        )
        mvc.get("/boards/$boardId/search") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            param("q", "batteries")
        }.andExpect {
            status { isOk() }
            jsonPath("$.items[0].title") { value("Batteries") }
        }
    }

    @Test
    fun opmlExport() {
        auth()
        ownedBoard()
        whenever(entries.findByBoardIdOrderBySortOrderAscAddedAtAsc(boardId)).thenReturn(
            listOf(
                BoardEntryEntity(
                    id = UUID.randomUUID(),
                    boardId = boardId,
                    articleId = "a1",
                    feedId = feedId,
                    title = "T",
                    addedAt = Instant.ofEpochMilli(1000),
                    sortOrder = 0,
                ),
            ),
        )
        whenever(
            feeds.findAllById(listOf(feedId)),
        ).thenReturn(listOf(FeedEntity(id = feedId, xmlUrl = "https://f.example/rss", title = "Feed")))
        mvc.get("/boards/$boardId/opml") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
        }
            .andExpect { status { isOk() } }
    }

    @Test
    fun reorderBoardsEmpty() {
        auth()
        mvc.post("/boards/reorder") {
            header("X-Api-Version", "1"); header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON; content = """{"ids":["not-a-uuid"]}"""
        }.andExpect { status { isOk() } }
    }

    @Test
    fun addEntryRace() {
        auth()
        ownedBoard()
        whenever(entries.findByBoardIdAndArticleId(boardId, "a1")).thenReturn(null).thenReturn(
            BoardEntryEntity(id = UUID.randomUUID(), boardId = boardId, articleId = "a1", title = "T", addedAt = Instant.ofEpochMilli(1000), sortOrder = 0),
        )
        whenever(articles.findById("a1")).thenReturn(Optional.of(ArticleEntity(id = "a1", feedId = feedId, title = "Article", publishedAt = Instant.ofEpochMilli(1000))))
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(feedId))
        whenever(feeds.findById(feedId)).thenReturn(Optional.of(FeedEntity(id = feedId, xmlUrl = "https://f.example/rss", title = "Feed")))
        whenever(entries.findFirstByBoardIdOrderBySortOrderDesc(boardId)).thenReturn(null)
        whenever(entries.save(any<BoardEntryEntity>())).thenThrow(DataIntegrityViolationException("dup"))
        mvc.post("/boards/$boardId/entries") {
            header("X-Api-Version", "1"); header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON; content = """{"articleId":"a1"}"""
        }.andExpect { status { isOk() } }
    }

    @Test
    fun searchEntriesEmptyQuery() {
        auth()
        ownedBoard()
        whenever(entries.findByBoardIdOrderBySortOrderAscAddedAtAsc(boardId)).thenReturn(
            listOf(BoardEntryEntity(id = UUID.randomUUID(), boardId = boardId, articleId = "a1", title = "T", addedAt = Instant.ofEpochMilli(1000), sortOrder = 0)),
        )
        mvc.get("/boards/$boardId/search") { header("X-Api-Version", "1"); header("Authorization", "Bearer good") }
            .andExpect { status { isOk() } }
    }

    @Test
    fun noteEntryNotFound() {
        auth()
        ownedBoard()
        whenever(entries.findByBoardIdAndArticleId(boardId, "a1")).thenReturn(null)
        mvc.put("/boards/$boardId/entries/a1") {
            header("X-Api-Version", "1"); header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON; content = """{"note":"x"}"""
        }.andExpect { status { isNotFound() } }
    }

    @Test
    fun opmlExportMissingFeed() {
        auth()
        ownedBoard()
        whenever(entries.findByBoardIdOrderBySortOrderAscAddedAtAsc(boardId)).thenReturn(
            listOf(BoardEntryEntity(id = UUID.randomUUID(), boardId = boardId, articleId = "a1", feedId = UUID.randomUUID(), title = "T", addedAt = Instant.ofEpochMilli(1000), sortOrder = 0)),
        )
        whenever(feeds.findAllById(any())).thenReturn(emptyList())
        mvc.get("/boards/$boardId/opml") { header("X-Api-Version", "1"); header("Authorization", "Bearer good") }
            .andExpect { status { isOk() } }
    }


    @Test
    fun searchEntriesWithTokens() {
        auth()
        ownedBoard()
        whenever(entries.findByBoardIdOrderBySortOrderAscAddedAtAsc(boardId)).thenReturn(
            listOf(
                BoardEntryEntity(id = UUID.randomUUID(), boardId = boardId, articleId = "a1", title = "Batteries review", author = "Alice", summary = "lithium", note = "important", addedAt = Instant.ofEpochMilli(1000), sortOrder = 0),
                BoardEntryEntity(id = UUID.randomUUID(), boardId = boardId, articleId = "a2", title = "Solar power", addedAt = Instant.ofEpochMilli(2000), sortOrder = 1),
            ),
        )
        mvc.get("/boards/$boardId/search") {
            header("X-Api-Version", "1"); header("Authorization", "Bearer good")
            param("q", "batteries")
        }.andExpect { status { isOk() } }
    }

    @Test
    fun reorderEntriesMultiple() {
        auth()
        ownedBoard()
        val e1 = BoardEntryEntity(id = UUID.randomUUID(), boardId = boardId, articleId = "a1", title = "T1", addedAt = Instant.ofEpochMilli(1000), sortOrder = 0)
        val e2 = BoardEntryEntity(id = UUID.randomUUID(), boardId = boardId, articleId = "a2", title = "T2", addedAt = Instant.ofEpochMilli(2000), sortOrder = 1)
        whenever(entries.findByBoardIdAndArticleIdIn(boardId, listOf("a2", "a1"))).thenReturn(listOf(e1, e2))
        whenever(entries.saveAll(any<List<BoardEntryEntity>>())).thenAnswer { it.arguments[0] }
        mvc.post("/boards/$boardId/entries/reorder") {
            header("X-Api-Version", "1"); header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON; content = """{"articleIds":["a2","a1"]}"""
        }.andExpect { status { isOk() } }
    }

    @Test
    fun opmlExportWithFeeds() {
        auth()
        ownedBoard()
        val fid = UUID.randomUUID()
        whenever(entries.findByBoardIdOrderBySortOrderAscAddedAtAsc(boardId)).thenReturn(
            listOf(BoardEntryEntity(id = UUID.randomUUID(), boardId = boardId, articleId = "a1", feedId = fid, title = "T", addedAt = Instant.ofEpochMilli(1000), sortOrder = 0)),
        )
        whenever(feeds.findAllById(listOf(fid))).thenReturn(listOf(FeedEntity(id = fid, xmlUrl = "https://f.example/rss", title = "Feed", siteUrl = "https://f.example")))
        mvc.get("/boards/$boardId/opml") { header("X-Api-Version", "1"); header("Authorization", "Bearer good") }
            .andExpect { status { isOk() } }
    }

}
