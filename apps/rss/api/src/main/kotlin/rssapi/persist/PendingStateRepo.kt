package rssapi.persist

import org.springframework.data.jpa.repository.JpaRepository
import java.time.Instant
import java.util.UUID

interface PendingStateRepo : JpaRepository<PendingStateEntity, Long> {
    fun findByFeedId(feedId: UUID): List<PendingStateEntity>
    fun deleteByFeedIdAndCreatedAtBefore(feedId: UUID, cutoff: Instant)
}
