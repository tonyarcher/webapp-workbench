package rssapi.feeds
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant
import java.util.UUID

interface FeedSyncRepo : JpaRepository<FeedSyncEntity, UUID> {
    @Query(
        """
        select s from FeedSyncEntity s
        where (s.nextAttemptAt is null and (s.lastFetchedAt is null or s.lastFetchedAt < :cutoff))
           or s.nextAttemptAt <= :now
        order by s.nextAttemptAt asc nulls first, s.lastFetchedAt asc nulls first
        """,
    )
    fun findDue(@Param("cutoff") cutoff: Instant, @Param("now") now: Instant, page: Pageable): List<FeedSyncEntity>
}
