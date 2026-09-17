package rssapi.persist

import java.time.Instant
import java.util.UUID
import org.springframework.data.jpa.repository.JpaRepository

interface PendingStateRepo : JpaRepository<PendingStateEntity, Long> {
    fun findByFeedId(feedId: UUID): List<PendingStateEntity>
    fun deleteByFeedIdAndCreatedAtBefore(feedId: UUID, cutoff: Instant)
}
