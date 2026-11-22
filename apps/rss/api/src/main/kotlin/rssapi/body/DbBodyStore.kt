package rssapi.body

import rssapi.persist.ArticleBodyEntity
import rssapi.persist.ArticleBodyRepo
import rssapi.persist.ArticleRepo

/** Bodies live in `article_bodies`. */
class DbBodyStore(private val articles: ArticleRepo, private val bodies: ArticleBodyRepo) : BodyStore {
    override fun get(articleId: String): String? =
        bodies.findById(articleId).orElse(null)?.contentHtml?.takeIf { it.isNotBlank() }

    override fun put(articleId: String, html: String) {
        // A blank body is indistinguishable from no body, and storing one adds
        // a row plus its foreign-key index entry for every link-only item.
        if (html.isBlank()) return
        if (!articles.existsById(articleId)) return
        bodies.save(ArticleBodyEntity(articleId, html))
    }
}
