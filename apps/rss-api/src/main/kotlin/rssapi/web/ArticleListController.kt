package rssapi.web

import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import rssapi.domain.ArticleSort
import rssapi.domain.clampPageLimit
import rssapi.domain.decodeCursor
import rssapi.domain.parseArticleScope
import rssapi.domain.parseArticleSort
import rssapi.persist.ArticleRepo
import rssapi.persist.ArticleStateId
import rssapi.persist.ArticleStateRepo

@RestController
class ArticleListController(
    private val user: IdentityUser,
    private val articles: ArticleRepo,
    private val states: ArticleStateRepo,
) {
    @GetMapping("/articles")
    fun list(
        @RequestParam(required = false) scope: String?,
        @RequestParam(required = false) unreadOnly: String?,
        @RequestParam(required = false) sort: String?,
        @RequestParam(required = false) cursor: String?,
        @RequestParam(required = false) limit: String?,
        @RequestParam(required = false) since: String?,
    ): ArticlePageJson {
        val parsedScope = try {
            parseArticleScope(scope ?: "all")
        } catch (err: IllegalArgumentException) {
            throw ApiException(400, err.message ?: "invalid scope", err)
        }
        val sinceMs = parseSince(since)
        val articleSort = parseArticleSort(sort)
        val pageLimit = clampPageLimit(limit?.toDoubleOrNull())
        val spec = articleSpec(
            user.id, parsedScope, unreadOnly == "1", articleSort, cursor?.let { decodeCursor(it) }, sinceMs,
        )
        val rows = articles.findAll(spec, PageRequest.of(0, pageLimit + 1, sortFor(articleSort))).content
        val hasMore = rows.size > pageLimit
        val page = rows.take(pageLimit)
        val stateMap = states.findByUserIdAndArticleIdIn(user.id, page.map { it.id }).associateBy { it.articleId }
        return ArticlePageJson(page.map { it.toJson(stateMap[it.id]) }, nextCursor(page, hasMore, articleSort))
    }
}

private fun parseSince(since: String?): Long? {
    if (since == null) return null
    return since.toDoubleOrNull()?.toLong() ?: throw ApiException(400, "invalid since")
}

private fun sortFor(sort: ArticleSort): Sort = when (sort) {
    ArticleSort.OLDEST -> Sort.by("publishedAt").ascending().and(Sort.by("id").ascending())
    ArticleSort.HOT -> Sort.by("hot").descending().and(Sort.by("id").descending())
    ArticleSort.NEWEST -> Sort.by("publishedAt").descending().and(Sort.by("id").descending())
}
