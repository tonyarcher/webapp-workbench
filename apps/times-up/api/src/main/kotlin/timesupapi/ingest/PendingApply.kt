package timesupapi.ingest
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import timesupapi.articles.ArticleEntity
import timesupapi.articles.ArticleRepo
import timesupapi.articles.ArticleStateEntity
import timesupapi.articles.ArticleStateId
import timesupapi.articles.ArticleStateRepo
import timesupapi.feeds.PendingStateEntity
import timesupapi.feeds.PendingStateRepo
import java.time.Duration
import java.time.Instant
import java.util.UUID

/** Pending rows older than this are swept as stale. */
private const val PENDING_TTL_HOURS = 48L

@Component
class PendingApply(
    private val pending: PendingStateRepo,
    private val articles: ArticleRepo,
    private val states: ArticleStateRepo,
) {
    @Transactional
    fun applyForFeed(feedId: UUID) {
        pending.findByFeedId(feedId).forEach { applyOne(it) }
        pending.deleteByFeedIdAndCreatedAtBefore(feedId, Instant.now().minus(Duration.ofHours(PENDING_TTL_HOURS)))
    }

    private fun applyOne(row: PendingStateEntity) {
        val match = matchArticle(row) ?: return
        val id = ArticleStateId(row.userId, match.id)
        val existing = states.findById(id).orElse(null)
        if (existing == null) {
            states.save(
                ArticleStateEntity(
                    userId = row.userId,
                    articleId = match.id,
                    read = row.read,
                    readAt = row.readAt,
                    starred = row.starred,
                ),
            )
        } else {
            existing.read = existing.read || row.read
            existing.starred = existing.starred || row.starred
            if (row.readAt != null) existing.readAt = existing.readAt ?: row.readAt
            states.save(existing)
        }
        pending.delete(row)
    }

    private fun matchArticle(row: PendingStateEntity): ArticleEntity? {
        if (row.guid != null) {
            articles.findByFeedIdAndGuid(row.feedId, row.guid!!)?.let { return it }
        }
        if (row.normLink != null) {
            return articles.findByFeedIdAndNormLink(row.feedId, row.normLink!!)
        }
        return null
    }
}
