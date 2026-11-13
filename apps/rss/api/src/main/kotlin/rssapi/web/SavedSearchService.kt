package rssapi.web

import org.springframework.stereotype.Service
import rssapi.domain.ArticleScope
import rssapi.domain.ArticleSort
import rssapi.domain.parseSearchQueryText
import rssapi.persist.ArticleRepo
import rssapi.persist.SavedSearchEntity
import rssapi.persist.SavedSearchRepo
import java.util.UUID

/** Unread counts for saved searches, kept apart from bulk library reads. */
@Service
class SavedSearchService(private val savedSearches: SavedSearchRepo, private val articles: ArticleRepo) {
    fun unreadMap(uid: UUID): Map<String, Int> {
        val rows = savedSearches.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid)
        if (rows.isEmpty()) return emptyMap()
        return rows.associate { it.id.toString() to unreadCount(uid, it) }
    }

    private fun unreadCount(uid: UUID, row: SavedSearchEntity): Int {
        val scope = scopeOf(row)
        val parsed = parseSearchQueryText(row.query)
        // A saved search with no text and no enforceable ops matches nothing useful server-side
        // (non-enforceable-only handled like client); count as 0 to avoid full scans.
        if (parsed.tokens.isEmpty() && !parsed.hasEnforceableOperator()) return 0
        val spec = articleSpec(uid, scope, true, ArticleSort.NEWEST, null, null, parsed)
        return articles.count(spec).toInt().coerceAtLeast(0)
    }

    private fun scopeOf(row: SavedSearchEntity): ArticleScope = when (row.scopeKind) {
        "feed" -> row.scopeId?.let { ArticleScope.Feed(it) } ?: ArticleScope.All
        "folder" -> row.scopeId?.let { ArticleScope.Folder(it) } ?: ArticleScope.All
        else -> ArticleScope.All
    }
}
