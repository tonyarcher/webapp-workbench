package timesupapi.boards

import java.time.Instant
import java.util.UUID

internal fun boardSummary(
    idValue: String = "a1",
    titleValue: String = "T",
    order: Int = 0,
    authorValue: String? = null,
    summaryValue: String? = null,
    noteValue: String = "",
    linkValue: String? = null,
    pending: Boolean = false,
): BoardEntryRepo.Summary = object : BoardEntryRepo.Summary {
    override val id = UUID.randomUUID()
    override val articleId = idValue
    override val feedId = null
    override val feedTitle = null
    override val title = titleValue
    override val link = linkValue
    override val author = authorValue
    override val summary = summaryValue
    override val publishedAt = Instant.ofEpochMilli(1_000)
    override val note = noteValue
    override val addedAt = Instant.ofEpochMilli(1_000)
    override val sortOrder = order
    override val contentPending = pending
}
