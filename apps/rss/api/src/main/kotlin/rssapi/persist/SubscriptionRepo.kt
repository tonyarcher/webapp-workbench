package rssapi.persist

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant
import java.util.UUID

interface SubscriptionRepo : JpaRepository<SubscriptionEntity, SubscriptionId> {
    @Query("select s.feedId from SubscriptionEntity s where s.userId = :userId")
    fun findFeedIdsByUserId(@Param("userId") userId: UUID): List<UUID>

    @Query(
        value = """
        SELECT max(u.last_seen_at) FROM subscriptions s
        JOIN users u ON u.id = s.user_id
        WHERE s.feed_id = :feedId
        """,
        nativeQuery = true,
    )
    fun findMaxLastSeenByFeedId(@Param("feedId") feedId: UUID): Instant?

    fun existsByUserIdAndFeedId(userId: UUID, feedId: UUID): Boolean
    fun deleteByUserIdAndFeedId(userId: UUID, feedId: UUID)
    fun countByFeedId(feedId: UUID): Long
}
