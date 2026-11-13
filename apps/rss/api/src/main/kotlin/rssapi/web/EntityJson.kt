package rssapi.web

import rssapi.persist.FeedEntity
import rssapi.persist.FolderEntity
import rssapi.persist.SavedArticleEntity
import rssapi.persist.SavedSearchEntity

fun FolderEntity.toJson(): FolderJson = FolderJson(
    id = id.toString(),
    title = title,
    createdAt = createdAt.toEpochMilli(),
    sortOrder = sortOrder,
)

fun FeedEntity.toJson(folderIds: List<String>, unread: Int, lastFetchedAt: Long?, lastError: String?): FeedJson =
    FeedJson(
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
