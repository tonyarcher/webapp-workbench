package timesupapi.boards
import org.springframework.http.HttpStatus
import timesupapi.articles.ArticleEntity
import timesupapi.articles.ArticleRepo
import timesupapi.feeds.FeedEntity
import timesupapi.feeds.FeedRepo
import timesupapi.feeds.SubscriptionRepo
import timesupapi.feeds.escXml
import timesupapi.platform.ApiException
import timesupapi.platform.isUuid
import java.util.UUID

private const val BOARD_SCORE_TITLE = 5
private const val BOARD_SCORE_AUTHOR = 3
private const val BOARD_SCORE_NOTE = 2

internal fun requireBoardTitle(raw: String?): String =
    raw?.trim()?.takeIf { it.isNotEmpty() } ?: throw ApiException(HttpStatus.BAD_REQUEST, "title is required")

internal fun boardId(raw: String): UUID =
    if (isUuid(raw)) UUID.fromString(raw) else throw ApiException(HttpStatus.BAD_REQUEST, "invalid board id")

internal fun ownedBoard(boards: BoardRepo, userId: UUID, id: UUID): BoardEntity =
    boards.findByUserIdAndId(userId, id) ?: throw ApiException(HttpStatus.NOT_FOUND, "board not found")

/** The article must exist and belong to a feed the reader subscribes to, so a
 *  board cannot pin arbitrary or foreign rows. */
internal fun resolveSubscribedArticle(
    articles: ArticleRepo,
    subs: SubscriptionRepo,
    userId: UUID,
    articleId: String,
): ArticleEntity {
    val article = articles.findById(articleId).orElseThrow {
        ApiException(HttpStatus.NOT_FOUND, "article not found")
    }
    if (article.feedId !in subs.findFeedIdsByUserId(userId).toSet()) {
        throw ApiException(HttpStatus.NOT_FOUND, "article not found")
    }
    return article
}

internal fun snapshotOf(
    article: ArticleEntity,
    feed: FeedEntity?,
    boardId: UUID,
    sortOrder: Int,
    contentHtml: String?,
    storageKey: String?,
): BoardEntryEntity = BoardEntryEntity(
    boardId = boardId,
    articleId = article.id,
    feedId = article.feedId,
    feedTitle = feed?.title,
    title = article.title,
    link = article.link,
    author = article.author,
    summary = article.summary,
    contentHtml = contentHtml,
    contentStorageKey = storageKey,
    publishedAt = article.publishedAt,
    sortOrder = sortOrder,
)

internal fun nextEntrySortOrder(entries: BoardEntryRepo, boardId: UUID): Int =
    (entries.findFirstByBoardIdOrderBySortOrderDesc(boardId)?.sortOrder ?: -1) + 1

/**
 * Token ranking over the board's own snapshots. Entries carry no read/star
 * state, so an operators-only query has nothing to filter on and returns the
 * board unchanged rather than pretending to apply `is:starred`.
 */
internal fun rankBoardEntries(rows: List<BoardEntryRepo.Summary>, tokens: List<String>): List<BoardEntryRepo.Summary> =
    rows.map { it to scoreEntry(it, tokens) }
        .sortedWith(
            compareByDescending<Pair<BoardEntryRepo.Summary, Int>> { it.second }
                .thenBy { it.first.sortOrder },
        )
        .map { it.first }

private fun scoreEntry(entry: BoardEntryRepo.Summary, tokens: List<String>): Int {
    var score = 0
    for (token in tokens) {
        if (fieldHits(entry.title, token)) score += BOARD_SCORE_TITLE
        if (fieldHits(entry.author, token)) score += BOARD_SCORE_AUTHOR
        if (fieldHits(entry.summary, token) || fieldHits(entry.note, token)) score += BOARD_SCORE_NOTE
        if (fieldHits(entry.link, token)) score += 1
    }
    return score
}

private fun fieldHits(field: String?, token: String): Boolean = field?.lowercase()?.contains(token) == true

/** A board exports as the distinct feeds its pinned rows came from, so the
 *  list is portable to another reader. Feeds missing from the pool are skipped
 *  rather than emitted without an xmlUrl. */
internal fun buildBoardOpml(boardTitle: String, rows: List<BoardEntryEntity>, feeds: Map<UUID, FeedEntity>): String {
    val lines = mutableListOf(
        """<?xml version="1.0" encoding="UTF-8"?>""",
        """<opml version="2.0">""",
        "<head><title>Board: ${escXml(boardTitle)}</title></head>",
        "<body>",
    )
    for (feedId in rows.mapNotNull { it.feedId }.distinct()) {
        val feed = feeds[feedId] ?: continue
        val text = escXml(feed.title)
        lines.add(
            """  <outline type="rss" text="$text" title="$text" xmlUrl="${escXml(
                feed.xmlUrl,
            )}" htmlUrl="${escXml(feed.siteUrl.orEmpty())}"/>""",
        )
    }
    lines.add("</body>")
    lines.add("</opml>")
    return lines.joinToString("\n")
}
