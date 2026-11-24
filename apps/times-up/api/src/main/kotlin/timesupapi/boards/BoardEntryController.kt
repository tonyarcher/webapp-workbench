package timesupapi.boards
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import timesupapi.articles.ArticleRepo
import timesupapi.articles.parseSearchQueryText
import timesupapi.feeds.FeedRepo
import timesupapi.feeds.OkBody
import timesupapi.feeds.SubscriptionRepo
import timesupapi.platform.ApiException
import timesupapi.platform.IdentityUser
import timesupapi.platform.toJson
import timesupapi.storage.BodyStore
import java.util.UUID

@RestController
class BoardEntryController(
    private val user: IdentityUser,
    private val boards: BoardRepo,
    private val entries: BoardEntryRepo,
    private val articles: ArticleRepo,
    private val feeds: FeedRepo,
    private val subs: SubscriptionRepo,
    private val bodyStore: BodyStore,
) {
    @GetMapping("/boards/{id}/entries", headers = ["X-Api-Version=1"])
    fun list(@PathVariable id: String): BoardEntryListJson {
        val board = ownedBoard(boards, user.id, boardId(id))
        return BoardEntryListJson(boardEntries(board).map { it.toJson() })
    }

    /** Adding the same article twice is a no-op that returns the pinned row,
     *  so a double click or a stale picker cannot create a duplicate. */
    @PostMapping("/boards/{id}/entries", headers = ["X-Api-Version=1"])
    fun add(@PathVariable id: String, @RequestBody body: BoardEntryBody): BoardEntryJson {
        val board = ownedBoard(boards, user.id, boardId(id))
        val articleId = body.articleId?.trim()?.takeIf { it.isNotEmpty() }
            ?: throw ApiException(HttpStatus.BAD_REQUEST, "articleId is required")
        entries.findByBoardIdAndArticleId(board.id!!, articleId)?.let { return it.toJson() }
        val article = resolveSubscribedArticle(articles, subs, user.id, articleId)
        val feed = feeds.findById(article.feedId).orElse(null)
        val row = try {
            entries.save(
                snapshotOf(
                    article,
                    feed,
                    board.id!!,
                    nextEntrySortOrder(entries, board.id!!),
                    bodyStore.get(article.id),
                ),
            )
        } catch (_: DataIntegrityViolationException) {
            entries.findByBoardIdAndArticleId(board.id!!, articleId)
                ?: throw ApiException(HttpStatus.CONFLICT, "Unable to add article to board")
        }
        return row.toJson()
    }

    @DeleteMapping("/boards/{id}/entries/{articleId}", headers = ["X-Api-Version=1"])
    @Transactional
    fun remove(@PathVariable id: String, @PathVariable articleId: String): OkBody {
        val board = ownedBoard(boards, user.id, boardId(id))
        entries.deleteByBoardIdAndArticleId(board.id!!, articleId.trim())
        return OkBody()
    }

    @PutMapping("/boards/{id}/entries/{articleId}", headers = ["X-Api-Version=1"])
    fun note(
        @PathVariable id: String,
        @PathVariable articleId: String,
        @RequestBody body: BoardNoteBody,
    ): BoardEntryJson {
        val board = ownedBoard(boards, user.id, boardId(id))
        val row = entries.findByBoardIdAndArticleId(board.id!!, articleId.trim())
            ?: throw ApiException(HttpStatus.NOT_FOUND, "board entry not found")
        row.note = body.note?.trim() ?: ""
        return entries.save(row).toJson()
    }

    @PostMapping("/boards/{id}/entries/reorder", headers = ["X-Api-Version=1"])
    @Transactional
    fun reorder(@PathVariable id: String, @RequestBody body: BoardArticleIdsBody): OkBody {
        val board = ownedBoard(boards, user.id, boardId(id))
        val articleIds = body.articleIds ?: throw ApiException(HttpStatus.BAD_REQUEST, "articleIds array is required")
        applyEntryOrder(board.id!!, articleIds)
        return OkBody()
    }

    @GetMapping("/boards/{id}/search", headers = ["X-Api-Version=1"])
    fun search(@PathVariable id: String, @RequestParam q: String?): BoardEntryListJson {
        val board = ownedBoard(boards, user.id, boardId(id))
        val tokens = q?.trim()?.takeIf { it.isNotEmpty() }?.let { parseSearchQueryText(it).tokens } ?: emptyList()
        val rows = boardEntries(board)
        val ranked = if (tokens.isEmpty()) rows else rankBoardEntries(rows, tokens)
        return BoardEntryListJson(ranked.map { it.toJson() })
    }

    @GetMapping("/boards/{id}/opml", produces = [MediaType.TEXT_XML_VALUE], headers = ["X-Api-Version=1"])
    fun opml(@PathVariable id: String): ResponseEntity<String> {
        val board = ownedBoard(boards, user.id, boardId(id))
        val rows = boardEntries(board)
        val feedMap = feeds.findAllById(rows.mapNotNull { it.feedId }.distinct()).associateBy { it.id!! }
        val xml = buildBoardOpml(board.title, rows, feedMap)
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("text/xml; charset=utf-8")).body(xml)
    }

    private fun boardEntries(board: BoardEntity) = entries.findByBoardIdOrderBySortOrderAscAddedAtAsc(board.id!!)

    private fun applyEntryOrder(boardId: UUID, articleIds: List<String>) {
        if (articleIds.isEmpty()) return
        val order = articleIds.withIndex().associate { it.value to it.index }
        val rows = entries.findByBoardIdAndArticleIdIn(boardId, articleIds)
        rows.forEach { it.sortOrder = order[it.articleId] ?: it.sortOrder }
        entries.saveAll(rows)
    }
}
