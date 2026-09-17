package rssapi.domain

import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class ArticleScopeBranchTest {
    @Test
    fun allAndSorts() {
        assertEquals(ArticleScope.All, parseArticleScope("all"))
        assertEquals(ArticleSort.OLDEST, parseArticleSort("oldest"))
        assertEquals(ArticleSort.HOT, parseArticleSort("hot"))
        assertEquals(ArticleSort.NEWEST, parseArticleSort(null))
        assertEquals(ArticleSort.NEWEST, parseArticleSort("nope"))
    }

    @Test
    fun feedAndFolder() {
        val feedId = UUID.randomUUID()
        assertEquals(ArticleScope.Feed(feedId), parseArticleScope("feed:$feedId"))
        val folderId = UUID.randomUUID()
        assertEquals(ArticleScope.Folder(folderId), parseArticleScope("folder:$folderId"))
    }

    @Test
    fun invalid() {
        assertFailsWith<IllegalArgumentException> { parseArticleScope("nope") }
        assertFailsWith<IllegalArgumentException> { parseArticleScope("feed:not-a-uuid") }
        assertFailsWith<IllegalArgumentException> { parseArticleScope("folder:not-a-uuid") }
    }

    @Test
    fun limits() {
        assertEquals(50, clampPageLimit(null))
        assertEquals(50, clampPageLimit(Double.NaN))
        assertEquals(1, clampPageLimit(0.0))
        assertEquals(10_000, clampPageLimit(99_999.0))
        assertEquals(5, clampPageLimit(5.0))
    }
}
