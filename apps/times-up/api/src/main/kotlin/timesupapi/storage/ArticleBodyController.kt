package timesupapi.storage
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RestController
import timesupapi.articles.ArticleBodyJson
import timesupapi.articles.ArticleEntity
import timesupapi.articles.ArticleRepo
import timesupapi.feeds.SubscriptionRepo
import timesupapi.platform.ApiException
import timesupapi.platform.IdentityUser
@RestController
class ArticleBodyController(
    private val user: IdentityUser,
    private val articles: ArticleRepo,
    private val subs: SubscriptionRepo,
    private val bodyStore: BodyStore,
) {
    @GetMapping("/articles/{articleId}/body", headers = ["X-Api-Version=1"])
    fun body(@PathVariable articleId: String): ArticleBodyJson {
        requireSubscribed(articleId)
        return ArticleBodyJson(bodyStore.get(articleId))
    }

    /**
     * The same body, still gzip, with `Content-Encoding: gzip`. The browser
     * inflates it, so the API never decodes a full body just to re-encode it as
     * JSON. Text is private to the subscriber, hence `Cache-Control: private`.
     */
    @GetMapping("/articles/{articleId}/body.raw", headers = ["X-Api-Version=1"])
    fun rawBody(@PathVariable articleId: String): ResponseEntity<ByteArray> {
        requireSubscribed(articleId)
        val stored = bodyStore.getRaw(articleId)
            ?: throw ApiException(HttpStatus.NOT_FOUND, "Article not found")
        val builder = ResponseEntity.ok()
            .contentType(MediaType.parseMediaType("text/html; charset=utf-8"))
            .contentLength(stored.bytes.size.toLong())
            .header(HttpHeaders.CACHE_CONTROL, "private, max-age=300")
        if (stored.gzip) builder.header(HttpHeaders.CONTENT_ENCODING, "gzip")
        return builder.body(stored.bytes)
    }

    private fun requireSubscribed(articleId: String): ArticleEntity {
        val article = articles.findById(articleId).orElseThrow {
            ApiException(HttpStatus.NOT_FOUND, "Article not found")
        }
        if (!subs.existsByUserIdAndFeedId(user.id, article.feedId)) {
            throw ApiException(HttpStatus.NOT_FOUND, "Article not found")
        }
        return article
    }
}
