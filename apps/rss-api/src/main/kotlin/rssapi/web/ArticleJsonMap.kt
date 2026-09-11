package rssapi.web

import rssapi.domain.encodeCursor
import rssapi.domain.firstImageUrl
import rssapi.domain.ArticleSort
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleStateEntity

fun ArticleEntity.toJson(state: ArticleStateEntity?): ArticleJson = ArticleJson(
    id = id,
    feedId = feedId.toString(),
    guid = guid,
    title = title,
    published = publishedAt.toEpochMilli(),
    fetchedAt = fetchedAt.toEpochMilli(),
    read = if (state?.read == true) 1 else 0,
    starred = state?.starred == true,
    popularity = popularity.toDouble(),
    hot = hot.toDouble(),
    link = link,
    author = author,
    summary = summary,
    content = contentHtml,
    image = firstImageUrl(contentHtml),
    normLink = normLink,
    comments = comments,
    engagement = engagement.toDouble().takeIf { it != 0.0 },
)

fun nextCursor(items: List<ArticleEntity>, hasMore: Boolean, sort: ArticleSort): String? {
    if (!hasMore || items.isEmpty()) return null
    val last = items.last()
    return if (sort == ArticleSort.HOT) encodeCursor(last.hot.toDouble(), last.id)
    else encodeCursor(last.publishedAt.toEpochMilli().toDouble(), last.id)
}
