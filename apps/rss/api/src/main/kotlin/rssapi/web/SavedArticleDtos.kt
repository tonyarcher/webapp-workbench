package rssapi.web

data class SavedArticleJson(
    val id: String,
    val articleId: String? = null,
    val feedId: String? = null,
    val feedTitle: String? = null,
    val title: String,
    val link: String? = null,
    val author: String? = null,
    val summary: String? = null,
    val content: String? = null,
    val published: Long? = null,
    val savedAt: Long,
)

data class SavedArticleListJson(val items: List<SavedArticleJson>)

data class SaveArticleBody(val articleId: String?)
