package rssapi.web

import rssapi.domain.ArticleSort
import rssapi.domain.encodeCursor
import rssapi.domain.firstImageUrl
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleScoreEntity
import rssapi.persist.ArticleStateEntity

fun ArticleEntity.toJson(state: ArticleStateEntity?, scores: ArticleScoreEntity? = null): ArticleJson = ArticleJson(
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
    scores = scores?.toScoresJson(),
)

private fun ArticleScoreEntity.toScoresJson(): ArticleScoresJson = ArticleScoresJson(
    worthy = worthy ?: 0.0,
    interest = interest ?: 0.0,
    topic = topic,
    popularityOutlook = popularityOutlook ?: 0.0,
    readability = readability ?: 0.0,
    scoredAt = scoredAt?.toEpochMilli(),
    model = model,
)

fun nextCursor(items: List<ArticleEntity>, hasMore: Boolean, sort: ArticleSort): String? {
    if (!hasMore || items.isEmpty()) return null
    val last = items.last()
    return if (sort == ArticleSort.HOT) {
        encodeCursor(last.hot.toDouble(), last.id)
    } else {
        encodeCursor(last.publishedAt.toEpochMilli().toDouble(), last.id)
    }
}
