package rssapi.storage
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import rssapi.articles.ArticleEntity
import rssapi.articles.ArticleRepo
import rssapi.feeds.SubscriptionRepo
import rssapi.platform.ApiException
import rssapi.platform.IdentityUser
import java.util.Optional
import java.util.UUID

class ArticleBodyControllerTest {
    private val user: IdentityUser = mock()
    private val articles: ArticleRepo = mock()
    private val subs: SubscriptionRepo = mock()
    private val bodyStore: BodyStore = mock()
    private val controller = ArticleBodyController(user, articles, subs, bodyStore)

    private val userId = UUID.randomUUID()
    private val feedId = UUID.randomUUID()

    @Test
    fun returnsBodyForOwnedArticle() {
        whenever(user.id).thenReturn(userId)
        whenever(articles.findById("a1")).thenReturn(Optional.of(ArticleEntity(id = "a1", feedId = feedId)))
        whenever(subs.existsByUserIdAndFeedId(userId, feedId)).thenReturn(true)
        whenever(bodyStore.get("a1")).thenReturn("<p>body</p>")

        val res = controller.body("a1")

        assertEquals("<p>body</p>", res.content)
    }

    @Test
    fun missingArticleIs404() {
        whenever(user.id).thenReturn(userId)
        whenever(articles.findById("missing")).thenReturn(Optional.empty())

        val err = assertThrows<ApiException> { controller.body("missing") }

        assertEquals(HttpStatus.NOT_FOUND, err.status)
    }

    @Test
    fun unownedArticleIs404() {
        whenever(user.id).thenReturn(userId)
        whenever(articles.findById("a1")).thenReturn(Optional.of(ArticleEntity(id = "a1", feedId = feedId)))
        whenever(subs.existsByUserIdAndFeedId(userId, feedId)).thenReturn(false)

        val err = assertThrows<ApiException> { controller.body("a1") }

        assertEquals(HttpStatus.NOT_FOUND, err.status)
    }

    @Test
    fun rawBodyKeepsGzipAndThePrivateCacheHeader() {
        whenever(user.id).thenReturn(userId)
        whenever(articles.findById("a1")).thenReturn(Optional.of(ArticleEntity(id = "a1", feedId = feedId)))
        whenever(subs.existsByUserIdAndFeedId(userId, feedId)).thenReturn(true)
        val gz = byteArrayOf(0x1f, 0x8b.toByte(), 0, 0)
        whenever(bodyStore.getRaw("a1")).thenReturn(StoredText(gz, true))

        val res = controller.rawBody("a1")

        assertEquals(gz.toList(), res.body?.toList())
        assertEquals("gzip", res.headers.getFirst("Content-Encoding"))
        assertEquals("private, max-age=300", res.headers.getFirst("Cache-Control"))
        assertEquals(gz.size.toLong(), res.headers.contentLength)
    }

    @Test
    fun rawBodyOmitsEncodingForPlainText() {
        whenever(user.id).thenReturn(userId)
        whenever(articles.findById("a1")).thenReturn(Optional.of(ArticleEntity(id = "a1", feedId = feedId)))
        whenever(subs.existsByUserIdAndFeedId(userId, feedId)).thenReturn(true)
        whenever(bodyStore.getRaw("a1")).thenReturn(StoredText("plain".toByteArray(), false))

        val res = controller.rawBody("a1")

        assertEquals(null, res.headers.getFirst("Content-Encoding"))
    }

    @Test
    fun rawBodyMissingIs404() {
        whenever(user.id).thenReturn(userId)
        whenever(articles.findById("a1")).thenReturn(Optional.of(ArticleEntity(id = "a1", feedId = feedId)))
        whenever(subs.existsByUserIdAndFeedId(userId, feedId)).thenReturn(true)
        whenever(bodyStore.getRaw("a1")).thenReturn(null)

        val err = assertThrows<ApiException> { controller.rawBody("a1") }

        assertEquals(HttpStatus.NOT_FOUND, err.status)
    }
}
