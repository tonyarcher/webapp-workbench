package rssapi.web

data class CreateFeedBody(val url: String?, val folderIds: List<String>? = null)

data class FolderIdsBody(val folderIds: List<String>?)

data class IdsBody(val ids: List<String>?)
