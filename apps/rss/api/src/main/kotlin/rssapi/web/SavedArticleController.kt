package rssapi.web

import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.HttpStatus
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleRepo
import rssapi.persist.FeedEntity
import rssapi.persist.FeedRepo
import rssapi.persist.SavedArticleEntity
import rssapi.persist.SavedArticleRepo
import rssapi.persist.SubscriptionRepo
import java.time.Instant

@RestController
class SavedArticleController(
    private val user: IdentityUser,
    private val saved: SavedArticleRepo,
    private val articles: ArticleRepo,
    private val feeds: FeedRepo,
    private val subs: SubscriptionRepo,
) {
    @GetMapping("/saved-articles", headers = ["X-Api-Version=1"])
    fun list(): SavedArticleListJson =
        SavedArticleListJson(saved.findByUserIdOrderBySavedAtDesc(user.id).map { it.toJson() })

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
            saved.save(snapshotOf(article, feed))
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

    private fun snapshotOf(article: ArticleEntity, feed: FeedEntity?): SavedArticleEntity = SavedArticleEntity(
        userId = user.id,
        articleId = article.id,
        feedId = article.feedId,
        feedTitle = feed?.title,
        title = article.title,
        link = article.link,
        author = article.author,
        summary = article.summary,
        contentHtml = article.contentHtml,
        publishedAt = article.publishedAt,
        savedAt = Instant.now(),
    )

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
