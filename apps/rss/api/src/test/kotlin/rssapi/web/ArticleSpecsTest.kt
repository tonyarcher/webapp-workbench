package rssapi.web

import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.CriteriaQuery
import jakarta.persistence.criteria.Root
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertNotNull
import org.mockito.Answers
import org.mockito.kotlin.mock
import rssapi.domain.ArticleScope
import rssapi.domain.ArticleSort
import rssapi.domain.CursorPayload
import rssapi.persist.ArticleEntity

class ArticleSpecsTest {
    private val cb: CriteriaBuilder = mock(defaultAnswer = Answers.RETURNS_DEEP_STUBS)
    private val query: CriteriaQuery<*> = mock(defaultAnswer = Answers.RETURNS_DEEP_STUBS)
    private val root: Root<ArticleEntity> = mock(defaultAnswer = Answers.RETURNS_DEEP_STUBS)
    private val userId = UUID.randomUUID()
    private val feedId = UUID.randomUUID()

    @Test
    fun allScopeBuilds() {
        val spec = articleSpec(userId, ArticleScope.All, false, ArticleSort.NEWEST, null, null)
        assertNotNull(spec.toPredicate(root, query, cb))
    }

    @Test
    fun feedScopeUnreadSince() {
        val spec = articleSpec(userId, ArticleScope.Feed(feedId), true, ArticleSort.OLDEST, null, 1_000L)
        assertNotNull(spec.toPredicate(root, query, cb))
    }

    @Test
    fun folderScopeHotCursor() {
        val spec = articleSpec(
            userId,
            ArticleScope.Folder(feedId),
            false,
            ArticleSort.HOT,
            CursorPayload(1.0, "a1"),
            null,
        )
        assertNotNull(spec.toPredicate(root, query, cb))
    }

    @Test
    fun newestCursor() {
        val spec = articleSpec(
            userId,
            ArticleScope.All,
            false,
            ArticleSort.NEWEST,
            CursorPayload(1_000.0, "a1"),
            null,
        )
        assertNotNull(spec.toPredicate(root, query, cb))
    }

    @Test
    fun oldestCursor() {
        val spec = articleSpec(
            userId,
            ArticleScope.All,
            false,
            ArticleSort.OLDEST,
            CursorPayload(1_000.0, "a1"),
            null,
        )
        assertNotNull(spec.toPredicate(root, query, cb))
    }
}
