package timesupapi.mcp
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Component
import timesupapi.articles.ArticleEntity
import timesupapi.articles.ArticleRepo
import timesupapi.articles.ArticleStateEntity
import timesupapi.articles.ArticleStateId
import timesupapi.articles.ArticleStateRepo
import timesupapi.boards.BoardEntryEntity
import timesupapi.boards.BoardEntryRepo
import timesupapi.boards.BoardRepo
import timesupapi.boards.SavedArticleEntity
import timesupapi.boards.SavedArticleRepo
import timesupapi.feeds.FeedRepo
import timesupapi.feeds.SubscriptionRepo
import timesupapi.platform.ApiException
import timesupapi.storage.BodyStore
import java.time.Instant
import java.util.UUID

@Component
class McpWriteTools(
    private val articles: ArticleRepo,
    private val subs: SubscriptionRepo,
    private val states: ArticleStateRepo,
    private val saved: SavedArticleRepo,
    private val boards: BoardRepo,
    private val entries: BoardEntryRepo,
    private val feeds: FeedRepo,
    private val bodies: BodyStore,
) {
    fun star(userId: UUID, articleId: String): Any {
        val article = owned(userId, articleId)
        val id = ArticleStateId(userId, article.id)
        val state = states.findById(id).orElse(ArticleStateEntity(userId = userId, articleId = article.id))
        state.starred = true
        states.save(state)
        return done("starred")
    }

    fun save(userId: UUID, articleId: String): Any {
        val article = owned(userId, articleId)
        if (saved.existsByUserIdAndArticleId(userId, article.id)) return done("already_saved")
        val feed = feeds.findById(article.feedId).orElse(null)
        saved.save(
            SavedArticleEntity(
                userId = userId,
                articleId = article.id,
                feedId = article.feedId,
                feedTitle = feed?.title,
                title = article.title,
                link = article.link,
                author = article.author,
                summary = article.summary,
                contentHtml = bodies.get(article.id),
                publishedAt = article.publishedAt,
                savedAt = Instant.now(),
            ),
        )
        return done("saved")
    }

    fun board(userId: UUID, articleId: String, boardId: String): Any {
        val article = owned(userId, articleId)
        val id = parseBoardId(boardId)
        val board = boards.findByUserIdAndId(userId, id) ?: throw ApiException(HttpStatus.NOT_FOUND, "Board not found")
        if (entries.findByBoardIdAndArticleId(id, article.id) != null) return done("already_pinned")
        val last = entries.findFirstByBoardIdOrderBySortOrderDesc(id)?.sortOrder ?: -1
        entries.save(
            BoardEntryEntity(
                boardId = board.id!!,
                articleId = article.id,
                feedId = article.feedId,
                title = article.title,
                link = article.link,
                summary = article.summary,
                contentHtml = bodies.get(article.id),
                publishedAt = article.publishedAt,
                sortOrder = last + 1,
                addedAt = Instant.now(),
            ),
        )
        return done("pinned")
    }

    private fun owned(userId: UUID, articleId: String): ArticleEntity {
        val article = articles.findById(articleId).orElseThrow {
            ApiException(HttpStatus.NOT_FOUND, "Article not found")
        }
        if (!subs.existsByUserIdAndFeedId(userId, article.feedId)) {
            throw ApiException(HttpStatus.NOT_FOUND, "Article not found")
        }
        return article
    }

    private fun parseBoardId(raw: String): UUID = try {
        UUID.fromString(raw.trim())
    } catch (_: IllegalArgumentException) {
        throw ApiException(HttpStatus.BAD_REQUEST, "invalid board id")
    }

    private fun done(status: String): Any = mapOf("ok" to true, "status" to status)
}
