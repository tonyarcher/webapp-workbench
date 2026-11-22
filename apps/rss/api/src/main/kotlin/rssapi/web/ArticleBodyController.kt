package rssapi.web

import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RestController
import rssapi.body.BodyStore
import rssapi.persist.ArticleRepo
import rssapi.persist.SubscriptionRepo

@RestController
class ArticleBodyController(
    private val user: IdentityUser,
    private val articles: ArticleRepo,
    private val subs: SubscriptionRepo,
    private val bodyStore: BodyStore,
) {
    @GetMapping("/articles/{articleId}/body", headers = ["X-Api-Version=1"])
    fun body(@PathVariable articleId: String): ArticleBodyJson {
        val article = articles.findById(articleId).orElseThrow {
            ApiException(HttpStatus.NOT_FOUND, "Article not found")
        }
        if (!subs.existsByUserIdAndFeedId(user.id, article.feedId)) {
            throw ApiException(HttpStatus.NOT_FOUND, "Article not found")
        }
        return ArticleBodyJson(bodyStore.get(articleId))
    }
}
