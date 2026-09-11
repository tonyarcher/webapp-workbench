package rssapi.persist

import java.time.Instant
import java.util.UUID
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface FeedSyncRepo : JpaRepository<FeedSyncEntity, UUID> {
    @Query(
        """
        select s from FeedSyncEntity s
        where s.lastFetchedAt is null or s.lastFetchedAt < :cutoff
        order by s.lastFetchedAt asc nulls first
        """,
    )
    fun findDue(@Param("cutoff") cutoff: Instant, page: Pageable): List<FeedSyncEntity>
}
