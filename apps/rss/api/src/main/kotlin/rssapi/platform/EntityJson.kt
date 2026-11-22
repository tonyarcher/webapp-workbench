package rssapi.platform
import rssapi.boards.BoardEntity
import rssapi.boards.BoardEntryEntity
import rssapi.boards.BoardEntryJson
import rssapi.boards.BoardJson
import rssapi.boards.SavedArticleEntity
import rssapi.boards.SavedArticleJson
import rssapi.boards.SavedSearchEntity
import rssapi.feeds.FeedEntity
import rssapi.feeds.FeedJson
import rssapi.feeds.FolderEntity
import rssapi.feeds.FolderJson
import rssapi.feeds.SavedSearchJson
fun FolderEntity.toJson(): FolderJson = FolderJson(
    id = id.toString(),
    title = title,
    createdAt = createdAt.toEpochMilli(),
    sortOrder = sortOrder,
)

fun FeedEntity.toJson(
    folderIds: List<String>,
    unread: Int,
    lastFetchedAt: Long?,
    lastError: String?,
    consecutiveFailures: Int = 0,
    status: String = "ok",
    sourceKind: String = "rss",
    itemSelector: String? = null,
): FeedJson = FeedJson(
    id = id.toString(),
    title = title,
    url = xmlUrl,
    folderIds = folderIds,
    unread = unread,
    addedAt = addedAt.toEpochMilli(),
    siteUrl = siteUrl,
    icon = icon,
    lastFetchedAt = lastFetchedAt,
    lastError = lastError,
    consecutiveFailures = consecutiveFailures,
    status = status,
    sourceKind = sourceKind,
    itemSelector = itemSelector,
)

fun SavedSearchEntity.toJson(unread: Int = 0): SavedSearchJson = SavedSearchJson(
    id = id.toString(),
    title = title,
    query = query,
    scopeKind = scopeKind,
    scopeId = scopeId?.toString(),
    sortOrder = sortOrder,
    createdAt = createdAt.toEpochMilli(),
    unread = unread,
)

fun SavedArticleEntity.toSavedArticleJson(): SavedArticleJson = SavedArticleJson(
    id = id.toString(),
    articleId = articleId,
    feedId = feedId?.toString(),
    feedTitle = feedTitle,
    title = title,
    link = link,
    author = author,
    summary = summary,
    content = contentHtml,
    published = publishedAt?.toEpochMilli(),
    savedAt = savedAt.toEpochMilli(),
)

fun BoardEntity.toJson(): BoardJson = BoardJson(
    id = id.toString(),
    title = title,
    createdAt = createdAt.toEpochMilli(),
    sortOrder = sortOrder,
)

fun BoardEntryEntity.toJson(): BoardEntryJson = BoardEntryJson(
    id = id.toString(),
    articleId = articleId,
    feedId = feedId?.toString(),
    feedTitle = feedTitle,
    title = title,
    link = link,
    author = author,
    summary = summary,
    content = contentHtml,
    published = publishedAt?.toEpochMilli(),
    note = note,
    addedAt = addedAt.toEpochMilli(),
    sortOrder = sortOrder,
)
