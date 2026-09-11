package rssapi.web

data class FolderJson(
    val id: String,
    val title: String,
    val createdAt: Long,
    val sortOrder: Int,
)

data class FeedJson(
    val id: String,
    val title: String,
    val url: String,
    val folderIds: List<String>,
    val unread: Int,
    val addedAt: Long,
    val siteUrl: String? = null,
    val lastFetchedAt: Long? = null,
    val lastError: String? = null,
)

data class LibraryJson(val folders: List<FolderJson>, val feeds: List<FeedJson>)

data class TitleBody(val title: String?)

data class OkBody(val ok: Boolean = true)
