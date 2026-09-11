package rssapi.domain

import java.util.UUID

sealed class ArticleScope {
    data object All : ArticleScope()
    data class Feed(val id: UUID) : ArticleScope()
    data class Folder(val id: UUID) : ArticleScope()
}

enum class ArticleSort { NEWEST, OLDEST, HOT }

fun parseArticleScope(raw: String): ArticleScope {
    if (raw == "all") return ArticleScope.All
    prefixedUuid(raw, "feed:")?.let { return ArticleScope.Feed(it) }
    prefixedUuid(raw, "folder:")?.let { return ArticleScope.Folder(it) }
    throw IllegalArgumentException("invalid scope")
}

private fun prefixedUuid(raw: String, prefix: String): UUID? {
    if (!raw.startsWith(prefix)) return null
    val id = raw.removePrefix(prefix)
    if (!isUuid(id)) throw IllegalArgumentException("invalid ${prefix.trimEnd(':')} id")
    return UUID.fromString(id)
}

fun parseArticleSort(raw: String?): ArticleSort = when (raw) {
    "oldest" -> ArticleSort.OLDEST
    "hot" -> ArticleSort.HOT
    else -> ArticleSort.NEWEST
}

fun clampPageLimit(raw: Double?): Int {
    if (raw == null || !raw.isFinite()) return rssapi.PAGE_LIMIT_DEFAULT
    return minOf(10_000, maxOf(1, raw.toInt()))
}
