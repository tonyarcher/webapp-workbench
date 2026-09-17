package rssapi.web

import java.time.Instant
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import rssapi.domain.ArticleSort
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleStateEntity

class ArticleJsonMapTest {
    private fun article(id: String, hot: Float, published: Long): ArticleEntity = ArticleEntity(
        id = id,
        feedId = UUID.randomUUID(),
        guid = "g-$id",
        title = "t-$id",
        publishedAt = Instant.ofEpochMilli(published),
        fetchedAt = Instant.ofEpochMilli(published),
        popularity = 1.5f,
        engagement = 2f,
        hot = hot,
        contentHtml = "<p>hi</p><img src=\"https://example.com/a.png\">",
    )

    @Test
    fun toJsonMapsReadStarred() {
        val row = article("a1", 3f, 1_700_000_000_000)
        val state = ArticleStateEntity(read = true, starred = true)
        val json = row.toJson(state)
        assertEquals("a1", json.id)
        assertEquals(1, json.read)
        assertEquals(true, json.starred)
        assertEquals("https://example.com/a.png", json.image)
    }

    @Test
    fun toJsonDefaultsUnread() {
        val row = article("a2", 1f, 1_700_000_000_000)
        val json = row.toJson(null)
        assertEquals(0, json.read)
        assertEquals(false, json.starred)
    }

    @Test
    fun toJsonZeroEngagement() {
        val row = article("a3", 1f, 1_700_000_000_000).apply {
            engagement = 0f
            comments = null
            author = null
        }
        val json = row.toJson(null)
        assertEquals(null, json.engagement)
        assertEquals(null, json.comments)
        assertEquals(null, json.author)
    }

    @Test
    fun nextCursorNullWhenEmpty() {
        assertNull(nextCursor(emptyList(), hasMore = true, ArticleSort.NEWEST))
        assertNull(nextCursor(listOf(article("a", 1f, 10)), hasMore = false, ArticleSort.NEWEST))
    }

    @Test
    fun nextCursorHotAndNewest() {
        val items = listOf(article("a", 1f, 10), article("b", 2f, 20))
        val hot = nextCursor(items, hasMore = true, ArticleSort.HOT)
        assertTrue(!hot.isNullOrEmpty())
        val newest = nextCursor(items, hasMore = true, ArticleSort.NEWEST)
        assertTrue(!newest.isNullOrEmpty())
    }
}
