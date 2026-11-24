package timesupapi.ai
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import timesupapi.articles.ArticleRepo
import timesupapi.feeds.SubscriptionRepo
import timesupapi.frontpage.wordCountOf
import timesupapi.platform.ApiException
import timesupapi.platform.IdentityUser
import timesupapi.storage.BodyStore
data class AiStatusJson(val available: Boolean, val provider: String, val model: String)

data class AiSummarizeBody(val title: String?, val text: String?, val length: String? = null)

data class AiSummaryJson(val summary: String)

data class HighlightExcerptJson(val index: Int, val text: String, val score: Double)

data class AiHighlightsJson(
    val available: Boolean,
    val excerpts: List<HighlightExcerptJson> = emptyList(),
    val interesting: Double? = null,
    val spam: Double? = null,
)

@RestController
class AiController(
    private val user: IdentityUser,
    private val ai: AiService,
    private val articles: ArticleRepo,
    private val subs: SubscriptionRepo,
    private val highlights: AiHighlightService,
    private val bodyStore: BodyStore,
) {
    @GetMapping("/ai/status", headers = ["X-Api-Version=1"])
    fun status(): AiStatusJson {
        val status = ai.status()
        return AiStatusJson(status.available, status.provider, status.model)
    }

    @PostMapping("/ai/summarize", headers = ["X-Api-Version=1"])
    fun summarize(@RequestBody body: AiSummarizeBody): AiSummaryJson {
        val text = body.text ?: throw ApiException(HttpStatus.BAD_REQUEST, "text is required")
        val length = SummaryLength.parse(body.length)
        return AiSummaryJson(ai.summarize(user.id, body.title, text, length))
    }

    /**
     * Extractive key lines plus typed why signals for one article. The
     * excerpts are verbatim slices of the article; nothing is generated.
     */
    @GetMapping("/ai/highlights/{articleId}", headers = ["X-Api-Version=1"])
    fun highlights(@PathVariable articleId: String): AiHighlightsJson {
        val uid = user.id
        val article = articles.findById(articleId).orElseThrow {
            ApiException(HttpStatus.NOT_FOUND, "Article not found")
        }
        if (article.feedId !in subs.findFeedIdsByUserId(uid).toSet()) {
            throw ApiException(HttpStatus.NOT_FOUND, "Article not found")
        }
        val body = bodyStore.get(articleId)
        val readMinutes = ((wordCountOf(article.summary, body) + 249) / 250).coerceAtLeast(1)
        val result: HighlightResult = highlights.highlights(uid, article.title, body, readMinutes)
        return AiHighlightsJson(
            available = result.available,
            excerpts = result.excerpts.map { HighlightExcerptJson(it.index, it.text, it.score) },
            interesting = result.interesting,
            spam = result.spam,
        )
    }
}
