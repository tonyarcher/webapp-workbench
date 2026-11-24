package timesupapi.articles
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import timesupapi.feeds.SubscriptionRepo
import timesupapi.platform.ApiException
import timesupapi.platform.IdentityUser
import java.util.UUID

class ArticleExcerptControllerTest {
    private val user: IdentityUser = mock()
    private val excerpts: ArticleExcerptService = mock()
    private val subs: SubscriptionRepo = mock()
    private val controller = ArticleExcerptController(user, excerpts, subs)

    private val userId = UUID.randomUUID()
    private val feedId = UUID.randomUUID()

    @Test
    fun returnsExcerptForOwnedArticle() {
        whenever(user.id).thenReturn(userId)
        whenever(excerpts.load("a1")).thenReturn(CachedArticleExcerpt(feedId, "a short excerpt"))
        whenever(subs.existsByUserIdAndFeedId(userId, feedId)).thenReturn(true)

        assertEquals("a short excerpt", controller.excerpt("a1").excerpt)
    }

    @Test
    fun missingArticleIs404() {
        whenever(user.id).thenReturn(userId)
        whenever(excerpts.load("missing")).thenReturn(null)

        val err = assertThrows<ApiException> { controller.excerpt("missing") }

        assertEquals(HttpStatus.NOT_FOUND, err.status)
    }

    @Test
    fun unownedArticleIs404() {
        whenever(user.id).thenReturn(userId)
        whenever(excerpts.load("a1")).thenReturn(CachedArticleExcerpt(feedId, "a short excerpt"))
        whenever(subs.existsByUserIdAndFeedId(userId, feedId)).thenReturn(false)

        val err = assertThrows<ApiException> { controller.excerpt("a1") }

        assertEquals(HttpStatus.NOT_FOUND, err.status)
    }
}
