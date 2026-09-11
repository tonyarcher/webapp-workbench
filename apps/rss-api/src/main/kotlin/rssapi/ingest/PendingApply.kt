package rssapi.ingest

import java.time.Instant
import java.time.Duration
import java.util.UUID
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import rssapi.persist.ArticleRepo
import rssapi.persist.ArticleStateEntity
import rssapi.persist.ArticleStateRepo
import rssapi.persist.PendingStateEntity
import rssapi.persist.PendingStateRepo

@Component
class PendingApply(
    private val pending: PendingStateRepo,
    private val articles: ArticleRepo,
    private val states: ArticleStateRepo,
) {
    @Transactional
    fun applyForFeed(feedId: UUID) {
        pending.findByFeedId(feedId).forEach { applyOne(it) }
        pending.deleteByFeedIdAndCreatedAtBefore(feedId, Instant.now().minus(Duration.ofHours(48)))
    }

    private fun applyOne(row: PendingStateEntity) {
        val match = matchArticle(row) ?: return
        val id = rssapi.persist.ArticleStateId(row.userId, match.id)
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

    private fun matchArticle(row: PendingStateEntity): rssapi.persist.ArticleEntity? {
        if (row.guid != null) {
            articles.findByFeedIdAndGuid(row.feedId, row.guid!!)?.let { return it }
        }
        if (row.normLink != null) {
            return articles.findByFeedIdAndNormLink(row.feedId, row.normLink!!)
        }
        return null
    }
}
