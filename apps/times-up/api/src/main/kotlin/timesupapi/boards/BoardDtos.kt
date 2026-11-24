package timesupapi.boards
data class BoardJson(val id: String, val title: String, val createdAt: Long, val sortOrder: Int)

data class BoardListJson(val items: List<BoardJson>)

data class BoardEntryJson(
    val id: String,
    val articleId: String,
    val feedId: String? = null,
    val feedTitle: String? = null,
    val title: String,
    val link: String? = null,
    val author: String? = null,
    val summary: String? = null,
    val content: String? = null,
    val published: Long? = null,
    val note: String = "",
    val addedAt: Long,
    val sortOrder: Int = 0,
)

data class BoardEntryListJson(val items: List<BoardEntryJson>)

data class BoardEntryBody(val articleId: String?)

data class BoardNoteBody(val note: String?)

data class BoardArticleIdsBody(val articleIds: List<String>?)
