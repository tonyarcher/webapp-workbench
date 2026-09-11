package fitnessapi.persist

import java.util.UUID
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface DailyRollupRepo : JpaRepository<DailyRollupEntity, DailyRollupId> {
    fun findByUserIdOrderByMetricAscDayAsc(userId: UUID): List<DailyRollupEntity>

    @Modifying
    @Query(
        value = "DELETE FROM daily_rollups WHERE user_id = :userId AND metric = ANY(:metrics)",
        nativeQuery = true,
    )
    fun deleteForMetrics(@Param("userId") userId: UUID, @Param("metrics") metrics: Array<String>)

    @Modifying
    @Query(
        value = """
        INSERT INTO daily_rollups (user_id, metric, day, min_si, max_si, avg_si, sum_si, n)
        SELECT user_id, metric, (t AT TIME ZONE 'UTC')::date AS day,
               MIN(value_si), MAX(value_si), AVG(value_si), SUM(value_si), COUNT(*)::int
        FROM samples
        WHERE user_id = :userId AND metric = ANY(:metrics) AND hidden = false
        GROUP BY user_id, metric, (t AT TIME ZONE 'UTC')::date
        """,
        nativeQuery = true,
    )
    fun rebuildForMetrics(@Param("userId") userId: UUID, @Param("metrics") metrics: Array<String>)
}
