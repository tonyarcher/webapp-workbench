package rssapi.clusters

import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import rssapi.articles.ArticleRepo
import rssapi.feeds.SubscriptionRepo
import rssapi.platform.ApiException
import rssapi.platform.IdentityUser

data class TopicClusterJson(
    val id: String,
    val label: String,
    val memberCount: Int,
    val growthRate: Double,
    val firstSeen: Long,
    val lastSeen: Long,
)

data class ArticleClusterJson(val id: String, val label: String, val memberCount: Int)

data class TopicClusterListJson(val clusters: List<TopicClusterJson>)

/** Persistent topic groups and the group of one subscriber-owned article. */
@RestController
class TopicClusterController(
    private val user: IdentityUser,
    private val articles: ArticleRepo,
    private val subs: SubscriptionRepo,
    private val service: TopicClusterService,
) {
    @GetMapping("/clusters", headers = ["X-Api-Version=1"])
    fun clusters(@RequestParam(defaultValue = "20") limit: Int): TopicClusterListJson = TopicClusterListJson(
        service.top(limit.coerceIn(1, MAX_LIMIT)).map { it.toJson() },
    )

    @GetMapping("/articles/{articleId}/cluster", headers = ["X-Api-Version=1"])
    fun cluster(@PathVariable articleId: String): ArticleClusterJson? {
        val article = articles.findById(articleId).orElseThrow { notFound() }
        if (!subs.existsByUserIdAndFeedId(user.id, article.feedId)) throw notFound()
        val cluster = service.forArticle(articleId) ?: return null
        return ArticleClusterJson(cluster.id, cluster.label, cluster.memberCount)
    }

    private fun notFound() = ApiException(HttpStatus.NOT_FOUND, "Article not found")

    private fun TopicClusterEntity.toJson() = TopicClusterJson(
        id,
        label,
        memberCount,
        growthRate,
        firstSeen.toEpochMilli(),
        lastSeen.toEpochMilli(),
    )

    private companion object {
        const val MAX_LIMIT = 100
    }
}
