package rssapi.web

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import rssapi.body.BodyStore
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleRepo
import rssapi.persist.SubscriptionRepo
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
}
