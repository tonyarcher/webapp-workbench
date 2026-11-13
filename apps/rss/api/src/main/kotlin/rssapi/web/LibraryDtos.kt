package rssapi.web

data class FolderJson(val id: String, val title: String, val createdAt: Long, val sortOrder: Int)

data class FeedJson(
    val id: String,
    val title: String,
    val url: String,
    val folderIds: List<String>,
    val unread: Int,
    val addedAt: Long,
    val siteUrl: String? = null,
    val icon: String? = null,
    val lastFetchedAt: Long? = null,
    val lastError: String? = null,
)

data class SavedSearchJson(
    val id: String,
    val title: String,
    val query: String,
    val scopeKind: String,
    val scopeId: String? = null,
    val sortOrder: Int,
    val createdAt: Long,
    val unread: Int = 0,
)

data class LibraryJson(
    val folders: List<FolderJson>,
    val feeds: List<FeedJson>,
    val savedSearches: List<SavedSearchJson> = emptyList(),
)

data class LibraryFoldersJson(val folders: List<FolderJson>, val savedSearches: List<SavedSearchJson> = emptyList())

data class LibraryFeedsJson(val feeds: List<FeedJson>)

data class LibraryCountsJson(val counts: Map<String, Int>, val savedSearchCounts: Map<String, Int> = emptyMap())

data class TitleBody(val title: String?)

data class OkBody(val ok: Boolean = true)

data class SavedSearchBody(
    val title: String? = null,
    val query: String? = null,
    val scopeKind: String? = null,
    val scopeId: String? = null,
)
