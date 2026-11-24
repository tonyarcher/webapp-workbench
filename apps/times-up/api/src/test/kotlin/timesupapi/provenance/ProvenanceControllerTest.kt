package timesupapi.provenance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import timesupapi.articles.ArticleEntity
import timesupapi.articles.ArticleRepo
import timesupapi.feeds.SubscriptionRepo
import timesupapi.platform.ApiException
import timesupapi.platform.IdentityUser
import java.util.Optional
import java.util.UUID
import kotlin.test.Test

class ProvenanceControllerTest {
    private val user: IdentityUser = mock()
    private val articles: ArticleRepo = mock()
    private val subs: SubscriptionRepo = mock()
    private val service: ProvenanceService = mock()
    private val controller = ProvenanceController(user, articles, subs, service)
    private val userId = UUID.randomUUID()
    private val feedId = UUID.randomUUID()
    private val article = ArticleEntity(id = "a1", feedId = feedId)

    @Test
    fun returnsProvenanceForOwnedArticle() {
        val expected = ArticleProvenanceJson(
            articleId = "a1",
            source = SourceRowJson(
                articleId = "a1",
                feedId = feedId.toString(),
                feedTitle = "Feed",
                sourceKind = null,
                connectorId = null,
                connectorVersion = null,
                fetchMode = null,
                canonicalUrl = null,
                sourceUrl = null,
                fetchedAt = 0,
            ),
        )
        whenever(user.id).thenReturn(userId)
        whenever(articles.findById("a1")).thenReturn(Optional.of(article))
        whenever(subs.existsByUserIdAndFeedId(userId, feedId)).thenReturn(true)
        whenever(service.load(article)).thenReturn(expected)

        assertEquals(expected, controller.provenance("a1"))
    }

    @Test
    fun missingArticleIs404() {
        whenever(user.id).thenReturn(userId)
        whenever(articles.findById("missing")).thenReturn(Optional.empty())

        val err = assertThrows<ApiException> { controller.provenance("missing") }

        assertEquals(HttpStatus.NOT_FOUND, err.status)
    }

    @Test
    fun unownedArticleIs404() {
        whenever(user.id).thenReturn(userId)
        whenever(articles.findById("a1")).thenReturn(Optional.of(article))
        whenever(subs.existsByUserIdAndFeedId(userId, feedId)).thenReturn(false)

        val err = assertThrows<ApiException> { controller.provenance("a1") }

        assertEquals(HttpStatus.NOT_FOUND, err.status)
    }
}
