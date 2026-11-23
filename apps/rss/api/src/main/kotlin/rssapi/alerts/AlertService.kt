package rssapi.alerts

import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service
import rssapi.articles.ArticleJson
import rssapi.articles.ArticleListQuery
import rssapi.articles.ArticleScope
import rssapi.articles.ArticleSort
import rssapi.articles.ArticleStateRepo
import rssapi.articles.articleSpec
import rssapi.articles.parseSearchQueryText
import rssapi.articles.toJson
import rssapi.boards.SavedSearchEntity
import rssapi.boards.SavedSearchRepo
import java.util.UUID

private const val MAX_ALERTS = 8
private const val PER_ALERT = 5

/** One keyword alert and its matching unread rows. No article body is read. */
data class AlertGroup(val id: String, val title: String, val query: String, val hits: List<ArticleJson>)

@Service
class AlertService(
    private val searches: SavedSearchRepo,
    private val listQuery: ArticleListQuery,
    private val states: ArticleStateRepo,
) {
    fun forUser(userId: UUID): List<AlertGroup> = searches.findByUserIdOrderBySortOrderAscCreatedAtAsc(userId)
        .asSequence()
        .filter { it.alert }
        .mapNotNull { groupFor(userId, it) }
        .take(MAX_ALERTS)
        .toList()

    private fun groupFor(userId: UUID, row: SavedSearchEntity): AlertGroup? {
        val parsed = parseSearchQueryText(row.query)
        if (parsed.tokens.isEmpty() && !parsed.hasEnforceableOperator()) return null
        val spec = articleSpec(userId, scopeOf(row), true, ArticleSort.NEWEST, null, null, parsed)
        val rows = listQuery.findAll(spec, PageRequest.of(0, PER_ALERT, Sort.by("publishedAt").descending()))
        val stateMap = states.findByUserIdAndArticleIdIn(userId, rows.map { it.id }).associateBy { it.articleId }
        val hits = rows.map { it.toJson(stateMap[it.id]) }
        if (hits.isEmpty()) return null
        return AlertGroup(row.id.toString(), row.title, row.query, hits)
    }

    private fun scopeOf(row: SavedSearchEntity): ArticleScope = when (row.scopeKind) {
        "feed" -> row.scopeId?.let { ArticleScope.Feed(it) } ?: ArticleScope.All
        "folder" -> row.scopeId?.let { ArticleScope.Folder(it) } ?: ArticleScope.All
        else -> ArticleScope.All
    }
}
