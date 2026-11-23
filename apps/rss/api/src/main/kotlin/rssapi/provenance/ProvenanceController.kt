package rssapi.provenance

import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RestController
import rssapi.articles.ArticleRepo
import rssapi.feeds.SubscriptionRepo
import rssapi.platform.ApiException
import rssapi.platform.IdentityUser

/** Verbatim evidence with stable ids for one subscriber-owned article. */
@RestController
class ProvenanceController(
    private val user: IdentityUser,
    private val articles: ArticleRepo,
    private val subs: SubscriptionRepo,
    private val service: ProvenanceService,
) {
    @GetMapping("/articles/{articleId}/provenance", headers = ["X-Api-Version=1"])
    fun provenance(@PathVariable articleId: String): ArticleProvenanceJson {
        val article = articles.findById(articleId).orElseThrow { notFound() }
        if (!subs.existsByUserIdAndFeedId(user.id, article.feedId)) throw notFound()
        return service.load(article)
    }

    private fun notFound() = ApiException(HttpStatus.NOT_FOUND, "Article not found")
}
