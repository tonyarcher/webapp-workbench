package timesupapi.boards

import java.time.Instant
import java.util.UUID

internal fun savedSummary(
    idValue: String = "a1",
    titleValue: String = "Saved title",
    pending: Boolean = false,
): SavedArticleRepo.Summary = object : SavedArticleRepo.Summary {
    override val id = UUID.randomUUID()
    override val articleId = idValue
    override val feedId = null
    override val feedTitle = "Feed"
    override val title = titleValue
    override val link = null
    override val author = null
    override val summary = null
    override val publishedAt = Instant.ofEpochMilli(1_000)
    override val savedAt = Instant.ofEpochMilli(1_000)
    override val contentPending = pending
}
