package rssapi.body

import rssapi.persist.ArticleRepo

/** Slice 1: bodies stay in `articles.content_html`. */
class DbBodyStore(private val articles: ArticleRepo) : BodyStore {
    override fun get(articleId: String): String? = articles.findById(articleId).orElse(null)?.contentHtml

    override fun put(articleId: String, html: String) {
        val article = articles.findById(articleId).orElse(null) ?: return
        if (article.contentHtml == html) return
        article.contentHtml = html
        articles.save(article)
    }
}
