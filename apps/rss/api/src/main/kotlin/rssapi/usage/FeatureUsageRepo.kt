package rssapi.usage
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate

interface FeatureUsageRepo : JpaRepository<FeatureUsageEntity, FeatureUsageId> {
    @Modifying
    @Transactional
    @Query(
        value = """
            insert into feature_usage (feature, day, count)
            values (:feature, :day, :count)
            on conflict (feature, day) do update
            set count = feature_usage.count + excluded.count
        """,
        nativeQuery = true,
    )
    fun increment(@Param("feature") feature: String, @Param("day") day: LocalDate, @Param("count") count: Long)

    @Modifying
    @Transactional
    @Query("delete from FeatureUsageEntity f where f.day < :cutoff")
    fun deleteOlderThan(@Param("cutoff") cutoff: LocalDate): Int

    fun findByDayBetweenOrderByDayAscFeatureAsc(from: LocalDate, to: LocalDate): List<FeatureUsageEntity>
}
