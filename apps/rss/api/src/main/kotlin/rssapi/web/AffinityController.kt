package rssapi.web
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import rssapi.persist.AffinityEntity
import rssapi.persist.AffinityId
import rssapi.persist.AffinityRepo
import rssapi.persist.ArticleRepo
import rssapi.persist.SubscriptionRepo
import java.time.Instant

/** Each touch decays the running affinity before the new amount is added. */
private const val AFFINITY_DECAY = 0.9f

@RestController
class AffinityController(
    private val user: IdentityUser,
    private val articles: ArticleRepo,
    private val affinity: AffinityRepo,
    private val subs: SubscriptionRepo,
) {
    @PostMapping("/affinity", headers = ["X-Api-Version=1"])
    fun add(@RequestBody body: AffinityBody): OkBody {
        val articleId = body.articleId
        val amount = body.amount
        if (articleId == null ||
            amount == null
        ) {
            throw ApiException(HttpStatus.BAD_REQUEST, "articleId and amount are required")
        }
        val article = articles.findById(articleId).orElseThrow {
            ApiException(HttpStatus.NOT_FOUND, "Article not found")
        }
        if (!subs.existsByUserIdAndFeedId(
                user.id,
                article.feedId,
            )
        ) {
            throw ApiException(HttpStatus.NOT_FOUND, "Article not found")
        }
        bump("aff:feed:${article.feedId}", amount)
        article.domain?.let { bump("aff:domain:$it", amount) }
        article.author?.let { bump("aff:author:${it.lowercase()}", amount) }
        return OkBody()
    }

    private fun bump(key: String, amount: Double) {
        val id = AffinityId(user.id, key)
        val row = affinity.findById(id).orElse(AffinityEntity(userId = user.id, key = key))
        row.value = maxOf(0f, row.value * AFFINITY_DECAY) + amount.toFloat()
        row.updatedAt = Instant.now()
        affinity.save(row)
    }
}
