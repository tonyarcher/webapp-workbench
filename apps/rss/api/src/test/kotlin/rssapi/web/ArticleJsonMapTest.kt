package rssapi.web

import rssapi.domain.ArticleSort
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleListRow
import rssapi.persist.ArticleStateEntity
import java.time.Instant
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

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
        assertNull(nextCursor(emptyList<ArticleEntity>(), hasMore = true, ArticleSort.NEWEST))
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

    @Test
    fun listRowToJsonOmitsContentButKeepsImage() {
        val json = listRow("https://img/x.png", 0f).toJson(ArticleStateEntity(read = true, starred = false))
        assertNull(json.content)
        assertEquals("https://img/x.png", json.image)
        assertEquals(1, json.read)
        assertNull(json.engagement)
    }

    private fun listRow(image: String?, engagement: Float) = ArticleListRow(
        id = "a1",
        feedId = UUID.randomUUID(),
        guid = "g1",
        title = "t",
        link = "https://example.com",
        normLink = "n",
        domain = "example.com",
        author = "a",
        summary = "s",
        excerpt = "e",
        image = image,
        comments = 1,
        publishedAt = Instant.ofEpochMilli(10),
        fetchedAt = Instant.ofEpochMilli(11),
        popularity = 1f,
        engagement = engagement,
        hot = 2f,
    )

    @Test
    fun nextCursorRowsHotAndNewest() {
        val rows = listOf(
            ArticleListRow(
                "a", UUID.randomUUID(), "g", "t", null, null, null, null, null, null, null, null,
                Instant.ofEpochMilli(
                    10,
                ),
                Instant.ofEpochMilli(10), 0f, 0f, 1f,
            ),
            ArticleListRow(
                "b", UUID.randomUUID(), "g2", "t2", null, null, null, null, null, null, null, null,
                Instant.ofEpochMilli(
                    20,
                ),
                Instant.ofEpochMilli(20), 0f, 0f, 2f,
            ),
        )
        assertNull(nextCursor(rows, hasMore = false, ArticleSort.HOT))
        assertTrue(!nextCursor(rows, hasMore = true, ArticleSort.HOT).isNullOrEmpty())
        assertTrue(!nextCursor(rows, hasMore = true, ArticleSort.NEWEST).isNullOrEmpty())
    }
}
