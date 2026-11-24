package timesupapi.clusters

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import timesupapi.articles.ArticleEntity
import timesupapi.articles.ArticleRepo
import timesupapi.feeds.SubscriptionRepo
import timesupapi.platform.ApiException
import timesupapi.platform.IdentityUser
import java.time.Instant
import java.util.Optional
import java.util.UUID
import kotlin.test.Test

class TopicClusterControllerTest {
    private val user: IdentityUser = mock()
    private val articles: ArticleRepo = mock()
    private val subs: SubscriptionRepo = mock()
    private val service: TopicClusterService = mock()
    private val controller = TopicClusterController(user, articles, subs, service)
    private val userId = UUID.randomUUID()
    private val feedId = UUID.randomUUID()
    private val article = ArticleEntity(id = "a1", feedId = feedId)
    private val cluster = TopicClusterEntity(
        id = "topic:1",
        label = "battery grid",
        memberCount = 4,
        growthRate = 0.5,
        firstSeen = Instant.parse("2026-11-20T00:00:00Z"),
        lastSeen = Instant.parse("2026-11-23T00:00:00Z"),
    )

    @Test
    fun listsTopClusters() {
        whenever(service.top(20)).thenReturn(listOf(cluster))

        val result = controller.clusters(20)

        assertEquals("topic:1", result.clusters.single().id)
        assertEquals(4, result.clusters.single().memberCount)
    }

    @Test
    fun articleWithoutAClusterReturnsNull() {
        whenever(user.id).thenReturn(userId)
        whenever(articles.findById("a1")).thenReturn(Optional.of(article))
        whenever(subs.existsByUserIdAndFeedId(userId, feedId)).thenReturn(true)

        assertNull(controller.cluster("a1"))
    }

    @Test
    fun articleClusterIsReturnedForOwnedArticle() {
        whenever(user.id).thenReturn(userId)
        whenever(articles.findById("a1")).thenReturn(Optional.of(article))
        whenever(subs.existsByUserIdAndFeedId(userId, feedId)).thenReturn(true)
        whenever(service.forArticle("a1")).thenReturn(cluster)

        assertEquals("battery grid", controller.cluster("a1")?.label)
    }

    @Test
    fun unownedArticleIs404() {
        whenever(user.id).thenReturn(userId)
        whenever(articles.findById("a1")).thenReturn(Optional.of(article))
        whenever(subs.existsByUserIdAndFeedId(userId, feedId)).thenReturn(false)

        val err = assertThrows<ApiException> { controller.cluster("a1") }

        assertEquals(HttpStatus.NOT_FOUND, err.status)
    }
}
