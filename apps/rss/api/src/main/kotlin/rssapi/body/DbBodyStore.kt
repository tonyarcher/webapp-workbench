package rssapi.body

import rssapi.persist.ArticleBodyEntity
import rssapi.persist.ArticleBodyRepo
import rssapi.persist.ArticleRepo

/**
 * Bodies live in `article_bodies`. The old `articles.content_html` column stays
 * authoritative until every reader has moved, so reads fall back to it and
 * writes keep both copies in sync for rollback.
 */
class DbBodyStore(private val articles: ArticleRepo, private val bodies: ArticleBodyRepo) : BodyStore {
    override fun get(articleId: String): String? = bodies.findById(articleId).orElse(null)?.contentHtml
        ?: articles.findById(articleId).orElse(null)?.contentHtml

    override fun put(articleId: String, html: String) {
        val article = articles.findById(articleId).orElse(null) ?: return
        bodies.save(ArticleBodyEntity(articleId, html))
        if (article.contentHtml == html) return
        article.contentHtml = html
        articles.save(article)
    }
}
