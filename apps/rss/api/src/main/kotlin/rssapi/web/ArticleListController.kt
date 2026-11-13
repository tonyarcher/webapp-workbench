package rssapi.web

import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import rssapi.domain.ArticleSort
import rssapi.domain.ParsedSearchQuery
import rssapi.domain.clampPageLimit
import rssapi.domain.decodeCursor
import rssapi.domain.parseArticleScope
import rssapi.domain.parseArticleSort
import rssapi.domain.parseSearchQueryText
import rssapi.persist.ArticleRepo
import rssapi.persist.ArticleStateId
import rssapi.persist.ArticleStateRepo

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
        val parsedScope = try {
            parseArticleScope(scope ?: "all")
        } catch (err: IllegalArgumentException) {
            throw ApiException(HttpStatus.BAD_REQUEST, err.message ?: "invalid scope", err)
        }
        val sinceMs = parseSince(since)
        val articleSort = parseArticleSort(sort)
        val pageLimit = clampPageLimit(limit?.toDoubleOrNull())
        val queryText = q?.trim()?.takeIf { it.isNotEmpty() }
        val parsedSearch = queryText?.let { parseSearchQueryText(it) }
        if (parsedSearch != null && parsedSearch.tokens.isEmpty() && !parsedSearch.hasAnyOperator()) {
            return ArticlePageJson(emptyList(), null)
        }
        val spec = articleSpec(
            user.id,
            parsedScope,
            unreadOnly == "1",
            articleSort,
            if (parsedSearch == null) cursor?.let { decodeCursor(it) } else null,
            sinceMs,
            parsedSearch,
        )
        if (parsedSearch != null) {
            val window = articles.findAll(
                spec,
                PageRequest.of(0, minOf(pageLimit * 4, 400), sortFor(ArticleSort.NEWEST)),
            ).content
            val ranked = rankSearchResults(window, parsedSearch).take(pageLimit)
            val stateMap = states.findByUserIdAndArticleIdIn(user.id, ranked.map { it.id }).associateBy { it.articleId }
            return ArticlePageJson(ranked.map { it.toJson(stateMap[it.id]) }, null)
        }
        val rows = articles.findAll(spec, PageRequest.of(0, pageLimit + 1, sortFor(articleSort))).content
        val hasMore = rows.size > pageLimit
        val page = rows.take(pageLimit)
        val stateMap = states.findByUserIdAndArticleIdIn(user.id, page.map { it.id }).associateBy { it.articleId }
        return ArticlePageJson(page.map { it.toJson(stateMap[it.id]) }, nextCursor(page, hasMore, articleSort))
    }
}

private fun parseSince(since: String?): Long? {
    if (since == null) return null
    return since.toDoubleOrNull()?.toLong() ?: throw ApiException(HttpStatus.BAD_REQUEST, "invalid since")
}

private fun sortFor(sort: ArticleSort): Sort = when (sort) {
    ArticleSort.OLDEST -> Sort.by("publishedAt").ascending().and(Sort.by("id").ascending())
    ArticleSort.HOT -> Sort.by("hot").descending().and(Sort.by("id").descending())
    ArticleSort.NEWEST -> Sort.by("publishedAt").descending().and(Sort.by("id").descending())
}

private fun fieldHits(field: String?, token: String): Boolean {
    val f = field?.lowercase() ?: return false
    return f.contains(token)
}

private fun rankSearchResults(
    rows: List<rssapi.persist.ArticleEntity>,
    search: ParsedSearchQuery,
): List<rssapi.persist.ArticleEntity> {
    val tokens = search.tokens
    if (tokens.isEmpty()) {
        return rows.sortedWith(
            compareByDescending<rssapi.persist.ArticleEntity> { it.publishedAt }
                .thenByDescending { it.id },
        )
    }
    return rows.map { article ->
        var score = 0
        for (token in tokens) {
            if (fieldHits(article.title, token)) score += 5
            if (fieldHits(article.author, token)) score += 3
            if (fieldHits(article.summary, token)) score += 2
            if (fieldHits(article.contentHtml, token)) score += 1
            if (fieldHits(article.domain, token)) score += 1
            if (fieldHits(article.link, token)) score += 1
        }
        article to score
    }.sortedWith(
        compareByDescending<Pair<rssapi.persist.ArticleEntity, Int>> { it.second }
            .thenByDescending { it.first.publishedAt }
            .thenByDescending { it.first.id },
    )
        .map { it.first }
}
