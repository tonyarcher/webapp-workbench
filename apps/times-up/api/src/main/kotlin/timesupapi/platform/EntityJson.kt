package timesupapi.platform
import timesupapi.boards.BoardEntity
import timesupapi.boards.BoardEntryEntity
import timesupapi.boards.BoardEntryJson
import timesupapi.boards.BoardJson
import timesupapi.boards.SavedArticleEntity
import timesupapi.boards.SavedArticleJson
import timesupapi.boards.SavedSearchEntity
import timesupapi.feeds.FeedEntity
import timesupapi.feeds.FeedJson
import timesupapi.feeds.FolderEntity
import timesupapi.feeds.FolderJson
import timesupapi.feeds.SavedSearchJson
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
    alert = alert,
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
