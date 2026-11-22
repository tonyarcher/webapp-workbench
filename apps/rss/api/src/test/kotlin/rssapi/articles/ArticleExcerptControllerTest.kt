package rssapi.articles
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import rssapi.feeds.SubscriptionRepo
import rssapi.platform.ApiException
import rssapi.platform.IdentityUser
import java.util.Optional
import java.util.UUID

class ArticleExcerptControllerTest {
    private val user: IdentityUser = mock()
    private val articles: ArticleRepo = mock()
    private val subs: SubscriptionRepo = mock()
    private val controller = ArticleExcerptController(user, articles, subs)

    private val userId = UUID.randomUUID()
    private val feedId = UUID.randomUUID()

    @Test
    fun returnsExcerptForOwnedArticle() {
        whenever(user.id).thenReturn(userId)
        whenever(articles.findById("a1")).thenReturn(
            Optional.of(ArticleEntity(id = "a1", feedId = feedId, excerpt = "a short excerpt")),
        )
        whenever(subs.existsByUserIdAndFeedId(userId, feedId)).thenReturn(true)

        assertEquals("a short excerpt", controller.excerpt("a1").excerpt)
    }

    @Test
    fun missingArticleIs404() {
        whenever(user.id).thenReturn(userId)
        whenever(articles.findById("missing")).thenReturn(Optional.empty())

        val err = assertThrows<ApiException> { controller.excerpt("missing") }

        assertEquals(HttpStatus.NOT_FOUND, err.status)
    }

    @Test
    fun unownedArticleIs404() {
        whenever(user.id).thenReturn(userId)
        whenever(articles.findById("a1")).thenReturn(Optional.of(ArticleEntity(id = "a1", feedId = feedId)))
        whenever(subs.existsByUserIdAndFeedId(userId, feedId)).thenReturn(false)

        val err = assertThrows<ApiException> { controller.excerpt("a1") }

        assertEquals(HttpStatus.NOT_FOUND, err.status)
    }
}
