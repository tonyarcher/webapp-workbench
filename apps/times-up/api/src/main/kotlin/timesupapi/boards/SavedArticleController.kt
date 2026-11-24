package timesupapi.boards
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.HttpStatus
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import timesupapi.articles.ArticleEntity
import timesupapi.articles.ArticleRepo
import timesupapi.feeds.FeedEntity
import timesupapi.feeds.FeedRepo
import timesupapi.feeds.OkBody
import timesupapi.feeds.SubscriptionRepo
import timesupapi.platform.ApiException
import timesupapi.platform.IdentityUser
import timesupapi.platform.toSavedArticleJson
import timesupapi.storage.BodyStore
import timesupapi.storage.SnapshotStore
import java.time.Instant

@RestController
class SavedArticleController(
    private val user: IdentityUser,
    private val saved: SavedArticleRepo,
    private val articles: ArticleRepo,
    private val feeds: FeedRepo,
    private val subs: SubscriptionRepo,
    private val bodyStore: BodyStore,
    private val snapshots: SnapshotStore,
) {
    @GetMapping("/saved-articles", headers = ["X-Api-Version=1"])
    fun list(): SavedArticleListJson =
        SavedArticleListJson(saved.findSummariesByUserIdOrderBySavedAtDesc(user.id).map { it.toSavedArticleJson() })

    @PostMapping("/saved-articles", headers = ["X-Api-Version=1"])
    fun save(@RequestBody body: SaveArticleBody): SavedArticleJson {
        val articleId = requireArticleId(body.articleId)
        saved.findByUserIdAndArticleId(user.id, articleId)?.let { return it.toJson() }
        val article = resolveSubscribedArticle(articleId)
        val feed = feeds.findById(article.feedId).orElse(null)
        // No method-level transaction: the repository save commits on its own and
        // surfaces a duplicate-key race here, where the winner's row can be read
        // back instead of answering 500.
        val row = try {
            val html = bodyStore.get(article.id)
            val storageKey = snapshots.put("saved", user.id, article.id, html)
            saved.save(snapshotOf(article, feed, html, storageKey))
        } catch (_: DataIntegrityViolationException) {
            saved.findByUserIdAndArticleId(user.id, articleId)
                ?: throw ApiException(HttpStatus.CONFLICT, "Unable to save article")
        }
        return row.toJson()
    }

    private fun requireArticleId(raw: String?): String = raw?.trim()?.takeIf { it.isNotEmpty() }
        ?: throw ApiException(HttpStatus.BAD_REQUEST, "articleId is required")

    private fun resolveSubscribedArticle(articleId: String): ArticleEntity {
        val article = articles.findById(articleId).orElseThrow {
            ApiException(HttpStatus.NOT_FOUND, "Article not found")
        }
        if (article.feedId !in subs.findFeedIdsByUserId(user.id).toSet()) {
            throw ApiException(HttpStatus.NOT_FOUND, "Article not found")
        }
        return article
    }

    private fun snapshotOf(
        article: ArticleEntity,
        feed: FeedEntity?,
        contentHtml: String?,
        storageKey: String?,
    ): SavedArticleEntity = SavedArticleEntity(
        userId = user.id,
        articleId = article.id,
        feedId = article.feedId,
        feedTitle = feed?.title,
        title = article.title,
        link = article.link,
        author = article.author,
        summary = article.summary,
        contentHtml = if (storageKey == null) contentHtml else null,
        contentStorageKey = storageKey,
        publishedAt = article.publishedAt,
        savedAt = Instant.now(),
    )

    @GetMapping("/saved-articles/{articleId}/content", headers = ["X-Api-Version=1"])
    fun content(@PathVariable articleId: String): SnapshotContentJson {
        val row = saved.findByUserIdAndArticleId(user.id, articleId)
            ?: throw ApiException(HttpStatus.NOT_FOUND, "Saved article not found")
        return SnapshotContentJson(snapshots.load(row.contentStorageKey, row.contentHtml))
    }

    @DeleteMapping("/saved-articles/{articleId}", headers = ["X-Api-Version=1"])
    @Transactional
    fun remove(@PathVariable articleId: String): OkBody {
        val id = articleId.trim()
        if (id.isEmpty()) throw ApiException(HttpStatus.BAD_REQUEST, "invalid article id")
        saved.deleteByUserIdAndArticleId(user.id, id)
        return OkBody()
    }
}

private fun SavedArticleEntity.toJson(): SavedArticleJson = toSavedArticleJson()
