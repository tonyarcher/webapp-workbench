package rssapi.articles
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RestController
import rssapi.feeds.SubscriptionRepo
import rssapi.platform.ApiException
import rssapi.platform.IdentityUser

/** Excerpt-only read for rows that scroll into view. The body stays behind /body. */
@RestController
class ArticleExcerptController(
    private val user: IdentityUser,
    private val excerpts: ArticleExcerptService,
    private val subs: SubscriptionRepo,
) {
    @GetMapping("/articles/{articleId}/excerpt", headers = ["X-Api-Version=1"])
    fun excerpt(@PathVariable articleId: String): ArticleExcerptJson {
        val article = excerpts.load(articleId) ?: throw ApiException(HttpStatus.NOT_FOUND, "Article not found")
        if (!subs.existsByUserIdAndFeedId(user.id, article.feedId)) {
            throw ApiException(HttpStatus.NOT_FOUND, "Article not found")
        }
        return ArticleExcerptJson(article.excerpt)
    }
}
