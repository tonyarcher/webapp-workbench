package rssapi.web

data class ArticleJson(
    val id: String,
    val feedId: String,
    val guid: String,
    val title: String,
    val published: Long,
    val fetchedAt: Long,
    val read: Int,
    val starred: Boolean,
    val popularity: Double,
    val hot: Double,
    val link: String? = null,
    val author: String? = null,
    val summary: String? = null,
    val content: String? = null,
    val image: String? = null,
    val normLink: String? = null,
    val comments: Int? = null,
    val engagement: Double? = null,
)

data class ArticlePageJson(val items: List<ArticleJson>, val nextCursor: String? = null)

data class StateUpdateBody(val id: String?, val read: Boolean? = null, val starred: Boolean? = null)

data class StateListBody(val updates: List<StateUpdateBody>?)

data class StateResult(val ok: Boolean = true, val updated: Int)

data class ReadBeforeBody(val feedIds: List<String>? = null, val cutoff: Long?)

data class ReadAllBody(val feedId: String? = null)

data class AffinityBody(val articleId: String?, val amount: Double?)
