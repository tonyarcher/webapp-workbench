package rssapi.web

import rssapi.persist.FeedEntity
import rssapi.persist.FolderEntity

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
): FeedJson = FeedJson(
    id = id.toString(),
    title = title,
    url = xmlUrl,
    folderIds = folderIds,
    unread = unread,
    addedAt = addedAt.toEpochMilli(),
    siteUrl = siteUrl,
    lastFetchedAt = lastFetchedAt,
    lastError = lastError,
)
