package rssapi.persist

import java.util.UUID
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface SubscriptionRepo : JpaRepository<SubscriptionEntity, SubscriptionId> {
    @Query("select s.feedId from SubscriptionEntity s where s.userId = :userId")
    fun findFeedIdsByUserId(@Param("userId") userId: UUID): List<UUID>

    fun existsByUserIdAndFeedId(userId: UUID, feedId: UUID): Boolean
    fun deleteByUserIdAndFeedId(userId: UUID, feedId: UUID)
    fun countByFeedId(feedId: UUID): Long
}
