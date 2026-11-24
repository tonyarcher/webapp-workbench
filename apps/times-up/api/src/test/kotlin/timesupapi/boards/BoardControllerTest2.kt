package timesupapi.boards
import org.junit.jupiter.api.BeforeEach
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
import timesupapi.articles.ArticleEntity
import timesupapi.feeds.FeedEntity
import timesupapi.feeds.FeedRepo
import timesupapi.feeds.SubscriptionRepo
import timesupapi.feeds.UserEntity
import timesupapi.feeds.UserRepo
import timesupapi.platform.IdentityUser
import timesupapi.platform.RequestIdFilter
import timesupapi.platform.SecurityConfig
import timesupapi.storage.BodyStore
import timesupapi.storage.SnapshotStore
import java.time.Instant
import java.util.Optional
import java.util.UUID

private fun boardJwt(sub: String): Jwt = Jwt.withTokenValue("tok")
    .header("alg", "RS256")
    .claim("sub", sub)
    .claim("preferred_username", "alice")
    .claim("aud", listOf("times-up"))
    .build()

@WebMvcTest(BoardController::class, BoardEntryController::class, BoardEntryExportController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, IdentityUser::class)
class BoardControllerTest2 {
    @Autowired lateinit var mvc: MockMvc

    @MockitoBean lateinit var decoder: JwtDecoder

    @MockitoBean lateinit var users: UserRepo

    @MockitoBean lateinit var boards: BoardRepo

    @MockitoBean lateinit var entries: BoardEntryRepo

    @MockitoBean lateinit var articles: timesupapi.articles.ArticleRepo

    @MockitoBean lateinit var feeds: FeedRepo

    @MockitoBean lateinit var subs: SubscriptionRepo

    @MockitoBean lateinit var bodyStore: BodyStore

    @MockitoBean lateinit var snapshots: SnapshotStore

    @BeforeEach
    fun emptySummaries() {
        whenever(entries.findSummariesByBoardIdOrderBySortOrderAscAddedAtAsc(any())).thenReturn(emptyList())
    }

    private val uid = UUID.randomUUID()
    private val boardId = UUID.randomUUID()
    private val feedId = UUID.randomUUID()

    private fun auth() {
        whenever(decoder.decode(any())).thenReturn(boardJwt("u1"))
        whenever(users.findBySubject("u1")).thenReturn(
            UserEntity(id = uid, label = "identity", subject = "u1", username = "alice"),
        )
    }

    private fun ownedBoard() {
        whenever(
            boards.findByUserIdAndId(uid, boardId),
        ).thenReturn(BoardEntity(id = boardId, userId = uid, title = "B"))
    }

    @Test
    fun reorderEntriesEmpty() {
        auth()
        ownedBoard()
        mvc.post("/boards/$boardId/entries/reorder") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"articleIds":[]}"""
        }.andExpect { status { isOk() } }
    }

    @Test
    fun addEntryUnsubscribed() {
        auth()
        ownedBoard()
        whenever(entries.findByBoardIdAndArticleId(boardId, "a1")).thenReturn(null)
        whenever(
            articles.findById("a1"),
        ).thenReturn(
            java.util.Optional.of(
                ArticleEntity(id = "a1", feedId = feedId, title = "Article", publishedAt = Instant.ofEpochMilli(1000)),
            ),
        )
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(UUID.randomUUID()))
        mvc.post("/boards/$boardId/entries") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"articleId":"a1"}"""
        }.andExpect { status { isNotFound() } }
    }

    @Test
    fun noteEntryNullNote() {
        auth()
        ownedBoard()
        val row =
            BoardEntryEntity(
                id = UUID.randomUUID(),
                boardId = boardId,
                articleId = "a1",
                title = "T",
                note = "old",
                addedAt = Instant.ofEpochMilli(1000),
                sortOrder = 0,
            )
        whenever(entries.findByBoardIdAndArticleId(boardId, "a1")).thenReturn(row)
        whenever(entries.save(any<BoardEntryEntity>())).thenAnswer { it.arguments[0] }
        mvc.put("/boards/$boardId/entries/a1") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{}"""
        }.andExpect {
            status { isOk() }
            jsonPath("$.note") { value("") }
        }
    }

    @Test
    fun addEntryBlankId() {
        auth()
        ownedBoard()
        mvc.post("/boards/$boardId/entries") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"articleId":"  "}"""
        }.andExpect { status { isBadRequest() } }
    }

    @Test
    fun addEntryRaceMissing() {
        auth()
        ownedBoard()
        whenever(entries.findByBoardIdAndArticleId(boardId, "a1")).thenReturn(null)
        whenever(
            articles.findById("a1"),
        ).thenReturn(
            java.util.Optional.of(
                ArticleEntity(id = "a1", feedId = feedId, title = "Article", publishedAt = Instant.ofEpochMilli(1000)),
            ),
        )
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(feedId))
        whenever(
            feeds.findById(feedId),
        ).thenReturn(java.util.Optional.of(FeedEntity(id = feedId, xmlUrl = "https://f.example/rss", title = "Feed")))
        whenever(entries.findFirstByBoardIdOrderBySortOrderDesc(boardId)).thenReturn(null)
        whenever(entries.save(any<BoardEntryEntity>())).thenThrow(DataIntegrityViolationException("dup"))
        whenever(entries.findByBoardIdAndArticleId(boardId, "a1")).thenReturn(null)
        mvc.post("/boards/$boardId/entries") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"articleId":"a1"}"""
        }.andExpect { status { isConflict() } }
    }

    @Test
    fun reorderEntriesNull() {
        auth()
        ownedBoard()
        mvc.post("/boards/$boardId/entries/reorder") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{}"""
        }.andExpect { status { isBadRequest() } }
    }

    @Test
    fun reorderEntriesPartial() {
        auth()
        ownedBoard()
        val e1 =
            BoardEntryEntity(
                id = UUID.randomUUID(),
                boardId = boardId,
                articleId = "a1",
                title = "T1",
                addedAt = Instant.ofEpochMilli(1000),
                sortOrder = 0,
            )
        whenever(entries.findByBoardIdAndArticleIdIn(boardId, listOf("a1"))).thenReturn(listOf(e1))
        whenever(entries.saveAll(any<List<BoardEntryEntity>>())).thenAnswer { it.arguments[0] }
        mvc.post("/boards/$boardId/entries/reorder") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"articleIds":["a1"]}"""
        }.andExpect { status { isOk() } }
    }

    @Test
    fun searchEntriesBlankQuery() {
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
        mvc.get("/boards/$boardId/search") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            param("q", "   ")
        }.andExpect { status { isOk() } }
    }
}
