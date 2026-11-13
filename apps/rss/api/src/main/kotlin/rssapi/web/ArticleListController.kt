package rssapi.web

import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.data.jpa.domain.Specification
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import rssapi.domain.ArticleScope
import rssapi.domain.ArticleSort
import rssapi.domain.ParsedSearchQuery
import rssapi.domain.clampPageLimit
import rssapi.domain.decodeCursor
import rssapi.domain.parseArticleScope
import rssapi.domain.parseArticleSort
import rssapi.domain.parseSearchQueryText
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleRepo
import rssapi.persist.ArticleStateEntity
import rssapi.persist.ArticleStateRepo

private const val SEARCH_WINDOW_MAX = 400
private const val SEARCH_WINDOW_FACTOR = 4
private const val SCORE_TITLE = 5
private const val SCORE_AUTHOR = 3
private const val SCORE_SUMMARY = 2
private const val SCORE_OTHER = 1

@RestController
class ArticleListController(
    private val user: IdentityUser,
    private val articles: ArticleRepo,
    private val states: ArticleStateRepo,
) {
    @GetMapping("/articles", headers = ["X-Api-Version=1"])
    fun list(
        @RequestParam(required = false) scope: String?,
        @RequestParam(required = false) unreadOnly: String?,
        @RequestParam(required = false) sort: String?,
        @RequestParam(required = false) cursor: String?,
        @RequestParam(required = false) limit: String?,
        @RequestParam(required = false) since: String?,
        @RequestParam(required = false) q: String?,
    ): ArticlePageJson {
        val parsedScope = parseScope(scope)
        val articleSort = parseArticleSort(sort)
        val pageLimit = clampPageLimit(limit?.toDoubleOrNull())
        val parsedSearch = parseQuery(q)
        if (isEmptyQuery(parsedSearch)) return ArticlePageJson(emptyList(), null)
        val spec = articleSpec(
            user.id,
            parsedScope,
            unreadOnly == "1",
            articleSort,
            if (parsedSearch == null) cursor?.let { decodeCursor(it) } else null,
            parseSince(since),
            parsedSearch,
        )
        return if (parsedSearch == null) {
            cursorPage(spec, articleSort, pageLimit)
        } else {
            searchPage(spec, parsedSearch, pageLimit)
        }
    }

    private fun parseScope(scope: String?): ArticleScope = try {
        parseArticleScope(scope ?: "all")
    } catch (err: IllegalArgumentException) {
        throw ApiException(HttpStatus.BAD_REQUEST, err.message ?: "invalid scope", err)
    }

    private fun searchPage(
        spec: Specification<ArticleEntity>,
        search: ParsedSearchQuery,
        pageLimit: Int,
    ): ArticlePageJson {
        val windowSize = minOf(pageLimit * SEARCH_WINDOW_FACTOR, SEARCH_WINDOW_MAX)
        val window = articles.findAll(spec, PageRequest.of(0, windowSize, sortFor(ArticleSort.NEWEST))).content
        val ranked = rankSearchResults(window, search).take(pageLimit)
        val stateMap = stateMapFor(ranked)
        return ArticlePageJson(ranked.map { it.toJson(stateMap[it.id]) }, null)
    }

    private fun cursorPage(spec: Specification<ArticleEntity>, sort: ArticleSort, pageLimit: Int): ArticlePageJson {
        val rows = articles.findAll(spec, PageRequest.of(0, pageLimit + 1, sortFor(sort))).content
        val hasMore = rows.size > pageLimit
        val page = rows.take(pageLimit)
        val stateMap = stateMapFor(page)
        return ArticlePageJson(page.map { it.toJson(stateMap[it.id]) }, nextCursor(page, hasMore, sort))
    }

    private fun stateMapFor(rows: List<ArticleEntity>): Map<String, ArticleStateEntity> =
        states.findByUserIdAndArticleIdIn(user.id, rows.map { it.id }).associateBy { it.articleId }
}

private fun parseSince(since: String?): Long? {
    if (since == null) return null
    return since.toDoubleOrNull()?.toLong() ?: throw ApiException(HttpStatus.BAD_REQUEST, "invalid since")
}

private fun parseQuery(q: String?): ParsedSearchQuery? =
    q?.trim()?.takeIf { it.isNotEmpty() }?.let { parseSearchQueryText(it) }

private fun isEmptyQuery(search: ParsedSearchQuery?): Boolean =
    search != null && search.tokens.isEmpty() && !search.hasAnyOperator()

private fun sortFor(sort: ArticleSort): Sort = when (sort) {
    ArticleSort.OLDEST -> Sort.by("publishedAt").ascending().and(Sort.by("id").ascending())
    ArticleSort.HOT -> Sort.by("hot").descending().and(Sort.by("id").descending())
    ArticleSort.NEWEST -> Sort.by("publishedAt").descending().and(Sort.by("id").descending())
}

private val NEWEST_FIRST: Comparator<ArticleEntity> =
    compareByDescending<ArticleEntity> { it.publishedAt }.thenByDescending { it.id }

private fun fieldHits(field: String?, token: String): Boolean {
    val f = field?.lowercase() ?: return false
    return f.contains(token)
}

private fun rankSearchResults(rows: List<ArticleEntity>, search: ParsedSearchQuery): List<ArticleEntity> {
    if (search.tokens.isEmpty()) return rows.sortedWith(NEWEST_FIRST)
    return rows.map { it to scoreArticle(it, search.tokens) }
        .sortedWith(
            compareByDescending<Pair<ArticleEntity, Int>> { it.second }
                .thenByDescending { it.first.publishedAt }
                .thenByDescending { it.first.id },
        )
        .map { it.first }
}

private fun scoreArticle(article: ArticleEntity, tokens: List<String>): Int {
    var score = 0
    for (token in tokens) {
        if (fieldHits(article.title, token)) score += SCORE_TITLE
        if (fieldHits(article.author, token)) score += SCORE_AUTHOR
        if (fieldHits(article.summary, token)) score += SCORE_SUMMARY
        if (fieldHits(article.contentHtml, token)) score += SCORE_OTHER
        if (fieldHits(article.domain, token)) score += SCORE_OTHER
        if (fieldHits(article.link, token)) score += SCORE_OTHER
    }
    return score
}
