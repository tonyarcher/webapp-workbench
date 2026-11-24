package rssapi.articles

import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RestController
import rssapi.feeds.SubscriptionRepo
import rssapi.platform.ApiException
import rssapi.platform.IdentityUser

/** One subscribed article for stable deep links; list bodies stay out of this route. */
@RestController
class ArticleDetailController(
    private val user: IdentityUser,
    private val articles: ArticleRepo,
    private val states: ArticleStateRepo,
    private val scores: ArticleScoreRepo,
    private val subscriptions: SubscriptionRepo,
) {
    @GetMapping("/articles/{id}", headers = ["X-Api-Version=1"])
    fun get(@PathVariable id: String): ArticleJson {
        val article = articles.findById(id).orElse(null) ?: throw notFound()
        val ownedFeeds = subscriptions.findFeedIdsByUserId(user.id).toSet()
        if (article.feedId !in ownedFeeds) throw notFound()
        val state = states.findByUserIdAndArticleIdIn(user.id, listOf(id)).firstOrNull()
        return article.toJson(state, scores.findById(id).orElse(null))
    }

    private fun notFound(): ApiException = ApiException(HttpStatus.NOT_FOUND, "article not found")
}
