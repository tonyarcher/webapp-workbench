package rssapi.web

data class MigrateFolder(val title: String, val sortOrder: Int? = null)

data class MigrateFeed(
    val url: String,
    val title: String? = null,
    val siteUrl: String? = null,
    val folderTitles: List<String>? = null,
)

data class MigrateState(
    val feedUrl: String,
    val guid: String? = null,
    val link: String? = null,
    val read: Boolean = false,
    val readAt: Long? = null,
    val starred: Boolean = false,
)

data class MigrateAffinity(val key: String, val value: Double)

data class MigrateBody(
    val folders: List<MigrateFolder>? = null,
    val feeds: List<MigrateFeed>? = null,
    val states: List<MigrateState>? = null,
    val affinity: List<MigrateAffinity>? = null,
)

data class MigrateResult(val feedsAdded: Int, val foldersAdded: Int, val statesQueued: Int)
