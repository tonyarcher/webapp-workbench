package rssapi.alerts

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import rssapi.articles.ArticleListQuery
import rssapi.articles.ArticleListRow
import rssapi.articles.ArticleStateEntity
import rssapi.articles.ArticleStateRepo
import rssapi.boards.SavedSearchEntity
import rssapi.boards.SavedSearchRepo
import java.time.Instant
import java.util.UUID

class AlertServiceTest {
    private val searches: SavedSearchRepo = mock()
    private val listQuery: ArticleListQuery = mock()
    private val states: ArticleStateRepo = mock()
    private val service = AlertService(searches, listQuery, states)
    private val userId = UUID.randomUUID()

    private fun search(id: UUID, query: String, alert: Boolean) = SavedSearchEntity(
        id = id,
        userId = userId,
        title = "Battery",
        query = query,
        alert = alert,
    )

    private fun hit(id: String) = ArticleListRow(
        id = id,
        feedId = UUID.randomUUID(),
        guid = "",
        title = "Story $id",
        link = null,
        normLink = null,
        domain = null,
        author = null,
        summary = "",
        excerpt = null,
        image = null,
        comments = null,
        publishedAt = Instant.parse("2026-11-23T00:00:00Z"),
        fetchedAt = Instant.parse("2026-11-23T00:00:00Z"),
        popularity = 0f,
        engagement = 0f,
        hot = 0f,
    )

    @Test
    fun onlyFlaggedSearchesWithMatchesBecomeAlerts() {
        val active = search(UUID.randomUUID(), "battery grid", true)
        val inactive = search(UUID.randomUUID(), "battery grid", false)
        whenever(searches.findByUserIdOrderBySortOrderAscCreatedAtAsc(userId)).thenReturn(listOf(active, inactive))
        whenever(listQuery.findAll(any(), any())).thenReturn(listOf(hit("a1")))

        val result = service.forUser(userId)

        assertEquals(1, result.size)
        assertEquals("Battery", result.single().title)
        assertEquals(listOf("a1"), result.single().hits.map { it.id })
    }

    @Test
    fun preservesStarredStateInHits() {
        whenever(searches.findByUserIdOrderBySortOrderAscCreatedAtAsc(userId))
            .thenReturn(listOf(search(UUID.randomUUID(), "battery", true)))
        whenever(listQuery.findAll(any(), any())).thenReturn(listOf(hit("a1")))
        whenever(states.findByUserIdAndArticleIdIn(any(), any())).thenReturn(
            listOf(ArticleStateEntity(userId = userId, articleId = "a1", starred = true)),
        )

        val result = service.forUser(userId)

        assertTrue(result.single().hits.single().starred)
    }

    @Test
    fun emptyQueryIsIgnoredWithoutReadingArticles() {
        val empty = search(UUID.randomUUID(), "", true)
        whenever(searches.findByUserIdOrderBySortOrderAscCreatedAtAsc(userId)).thenReturn(listOf(empty))

        assertTrue(service.forUser(userId).isEmpty())
        verify(listQuery, never()).findAll(any(), any())
    }

    @Test
    fun alertWithNoMatchesIsDropped() {
        whenever(searches.findByUserIdOrderBySortOrderAscCreatedAtAsc(userId))
            .thenReturn(listOf(search(UUID.randomUUID(), "battery", true)))
        whenever(listQuery.findAll(any(), any())).thenReturn(emptyList())

        assertTrue(service.forUser(userId).isEmpty())
    }
}
