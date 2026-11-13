package rssapi.web

import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.jpa.domain.Specification
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleRepo
import rssapi.persist.SavedSearchEntity
import rssapi.persist.SavedSearchRepo
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class SavedSearchServiceTest {
    private val savedSearches: SavedSearchRepo = mock()
    private val articles: ArticleRepo = mock()
    private val service = SavedSearchService(savedSearches, articles)
    private val uid = UUID.randomUUID()

    private fun stubRows(vararg rows: SavedSearchEntity, count: Long = 1L) {
        whenever(savedSearches.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid)).thenReturn(rows.toList())
        whenever(articles.count(any<Specification<ArticleEntity>>())).thenReturn(count)
    }

    @Test
    fun emptySearchListMeansNoCounts() {
        whenever(savedSearches.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid)).thenReturn(emptyList())
        assertTrue(service.unreadMap(uid).isEmpty())
        verify(articles, never()).count(any<Specification<ArticleEntity>>())
    }

    @Test
    fun queryWithoutTokensOrOperatorsCountsZero() {
        stubRows(SavedSearchEntity(id = UUID.randomUUID(), userId = uid, title = "Empty", query = "a"))
        val counts = service.unreadMap(uid)
        assertEquals(1, counts.size)
        assertEquals(0, counts.values.first())
    }

    @Test
    fun tokenQueryCountsMatchingArticles() {
        val id = UUID.randomUUID()
        stubRows(
            SavedSearchEntity(id = id, userId = uid, title = "Battery", query = "battery"),
            count = 4L,
        )
        assertEquals(4, service.unreadMap(uid)[id.toString()])
    }

    @Test
    fun feedAndFolderScopesUseTheirIds() {
        stubRows(
            SavedSearchEntity(
                id = UUID.randomUUID(),
                userId = uid,
                title = "F",
                query = "battery",
                scopeKind = "feed",
                scopeId = UUID.randomUUID(),
            ),
            SavedSearchEntity(
                id = UUID.randomUUID(),
                userId = uid,
                title = "D",
                query = "battery",
                scopeKind = "folder",
                scopeId = UUID.randomUUID(),
            ),
        )
        assertEquals(2, service.unreadMap(uid).size)
    }

    @Test
    fun scopeWithoutIdFallsBackToAll() {
        stubRows(
            SavedSearchEntity(id = UUID.randomUUID(), userId = uid, title = "F", query = "battery", scopeKind = "feed"),
            SavedSearchEntity(
                id = UUID.randomUUID(),
                userId = uid,
                title = "D",
                query = "battery",
                scopeKind = "folder",
            ),
            SavedSearchEntity(id = UUID.randomUUID(), userId = uid, title = "A", query = "battery", scopeKind = "all"),
        )
        assertEquals(3, service.unreadMap(uid).size)
    }
}
