package timesupapi.feeds
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant
import java.util.UUID

interface FeedSyncRepo : JpaRepository<FeedSyncEntity, UUID> {
    /**
     * Due rows with the login-recency gate applied in SQL. Active and unknown
     * readers keep the normal interval; inactive readers use the same Fibonacci
     * day backoff as [timesupapi.poller.FeedRecency] and stop after 30 days.
     * Filtering before LIMIT keeps a block of stale feeds from hiding active ones.
     */
    @Query(
        value = """
        WITH due AS (
            SELECT s.*,
                   (
                       SELECT max(u.last_seen_at)
                       FROM subscriptions sub
                       JOIN users u ON u.id = sub.user_id
                       WHERE sub.feed_id = s.feed_id
                   ) AS last_seen
            FROM feed_sync s
            WHERE (s.next_attempt_at IS NULL
                   AND (s.last_fetched_at IS NULL OR s.last_fetched_at < CAST(:cutoff AS timestamptz)))
               OR s.next_attempt_at <= CAST(:now AS timestamptz)
        )
        SELECT * FROM due
        WHERE last_seen IS NULL
           OR last_seen >= CAST(:now AS timestamptz) - INTERVAL '7 days'
           OR (
               last_seen >= CAST(:now AS timestamptz) - INTERVAL '30 days'
               AND (
                   next_attempt_at <= CAST(:now AS timestamptz)
                   OR last_fetched_at IS NULL
                   OR last_fetched_at < CAST(:now AS timestamptz) - CASE
                       WHEN last_seen >= CAST(:now AS timestamptz) - INTERVAL '14 days' THEN INTERVAL '1 day'
                       WHEN last_seen >= CAST(:now AS timestamptz) - INTERVAL '21 days' THEN INTERVAL '2 days'
                       WHEN last_seen >= CAST(:now AS timestamptz) - INTERVAL '28 days' THEN INTERVAL '3 days'
                       ELSE INTERVAL '5 days'
                   END
               )
           )
        ORDER BY next_attempt_at ASC NULLS FIRST, last_fetched_at ASC NULLS FIRST
        """,
        nativeQuery = true,
    )
    fun findDue(@Param("cutoff") cutoff: Instant, @Param("now") now: Instant, page: Pageable): List<FeedSyncEntity>
}
