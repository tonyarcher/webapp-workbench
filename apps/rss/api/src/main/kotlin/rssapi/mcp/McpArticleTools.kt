package rssapi.mcp
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Component
import rssapi.ai.AiHighlightService
import rssapi.articles.ArticleEntity
import rssapi.articles.ArticleListQuery
import rssapi.articles.ArticleRepo
import rssapi.articles.ArticleScope
import rssapi.articles.ArticleSort
import rssapi.articles.articleSpec
import rssapi.articles.parseSearchQueryText
import rssapi.feeds.SubscriptionRepo
import rssapi.frontpage.wordCountOf
import rssapi.platform.ApiException
import rssapi.storage.BodyStore
import java.util.UUID

private const val SEARCH_LIMIT = 10

@Component
class McpArticleTools(
    private val listQuery: ArticleListQuery,
    private val articles: ArticleRepo,
    private val subs: SubscriptionRepo,
    private val bodies: BodyStore,
    private val highlights: AiHighlightService,
) {
    fun search(userId: UUID, q: String): Any {
        val spec = articleSpec(userId, ArticleScope.All, false, ArticleSort.NEWEST, null, null, parseSearchQueryText(q))
        val sort = Sort.by("publishedAt").descending().and(Sort.by("id").descending())
        val rows = listQuery.findAll(spec, PageRequest.of(0, SEARCH_LIMIT, sort))
        return mapOf(
            "articles" to rows.map { row ->
                mapOf(
                    "id" to row.id,
                    "title" to row.title,
                    "summary" to row.summary,
                    "excerpt" to row.excerpt,
                    "published" to row.publishedAt.toEpochMilli(),
                )
            },
        )
    }

    fun summary(userId: UUID, articleId: String): Any {
        val article = owned(userId, articleId)
        return mapOf(
            "id" to article.id,
            "title" to article.title,
            "summary" to article.summary,
            "excerpt" to article.excerpt,
            "link" to article.link,
        )
    }

    fun body(userId: UUID, articleId: String): Any {
        val article = owned(userId, articleId)
        return mapOf("id" to article.id, "content" to bodies.get(article.id))
    }

    fun quote(userId: UUID, articleId: String): Any {
        val article = owned(userId, articleId)
        val body = bodies.get(article.id)
        val minutes = ((wordCountOf(article.summary, body) + 249) / 250).coerceAtLeast(1)
        val result = highlights.highlights(userId, article.title, body, minutes)
        return mapOf(
            "articleId" to article.id,
            "title" to article.title,
            "link" to article.link,
            "excerpts" to result.excerpts.map { mapOf("text" to it.text, "score" to it.score) },
            "available" to result.available,
        )
    }

    private fun owned(userId: UUID, articleId: String): ArticleEntity {
        val article = articles.findById(articleId).orElseThrow { notFound() }
        if (!subs.existsByUserIdAndFeedId(userId, article.feedId)) throw notFound()
        return article
    }

    private fun notFound() = ApiException(HttpStatus.NOT_FOUND, "Article not found")
}
