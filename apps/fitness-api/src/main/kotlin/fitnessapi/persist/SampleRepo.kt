package fitnessapi.persist

import java.time.Instant
import java.util.UUID
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface SampleRepo : JpaRepository<SampleEntity, UUID> {
    fun findByUserIdAndMetricAndOriginId(userId: UUID, metric: String, originId: String): SampleEntity?

    @Query(
        """
        select s.metric as metric, count(s) as n, min(s.t) as firstT, max(s.t) as lastT
        from SampleEntity s
        where s.userId = :userId and s.hidden = false
        group by s.metric
        order by s.metric
        """,
    )
    fun stats(@Param("userId") userId: UUID): List<MetricStatsView>

    @Query(
        value = """
        SELECT DISTINCT ON (metric) metric, t, value_si AS valueSi
        FROM samples
        WHERE user_id = :userId AND hidden = false
        ORDER BY metric, t DESC, (source = 'override') DESC, value_si DESC
        """,
        nativeQuery = true,
    )
    fun latest(@Param("userId") userId: UUID): List<LatestView>

    @Query(
        """
        from SampleEntity s
        where s.userId = :userId and s.hidden = false
          and s.t >= :fromTime and s.t <= :toTime
          and (:metric is null or s.metric = :metric)
        order by s.t asc
        """,
    )
    fun listVisible(
        @Param("userId") userId: UUID,
        @Param("metric") metric: String?,
        @Param("fromTime") fromTime: Instant,
        @Param("toTime") toTime: Instant,
        page: Pageable,
    ): List<SampleEntity>

    @Query(
        """
        from SampleEntity s
        where s.userId = :userId and s.metric = :metric and s.hidden = false
          and s.t >= :fromTime and s.t <= :toTime
        order by s.t asc
        """,
    )
    fun seriesRows(
        @Param("userId") userId: UUID,
        @Param("metric") metric: String,
        @Param("fromTime") fromTime: Instant,
        @Param("toTime") toTime: Instant,
    ): List<SampleEntity>
}
