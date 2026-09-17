package fitnessapi.persist

import java.time.Instant
import java.util.UUID
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface SampleWriteRepo : JpaRepository<SampleEntity, UUID> {
    @Modifying
    @Query(
        value = """
        INSERT INTO samples (user_id, metric, t, value_si, source, origin_id)
        VALUES (:userId, :metric, :t, :valueSi, :source, :originId)
        ON CONFLICT (user_id, metric, t, source, origin_id) DO UPDATE SET value_si = EXCLUDED.value_si
        """,
        nativeQuery = true,
    )
    fun upsert(
        @Param("userId") userId: UUID,
        @Param("metric") metric: String,
        @Param("t") t: Instant,
        @Param("valueSi") valueSi: Double,
        @Param("source") source: String,
        @Param("originId") originId: String,
    )

    @Modifying
    @Query(
        value = """
        UPDATE samples SET value_si = :valueSi, note = :note, hidden = false
        WHERE user_id = :userId AND metric = :metric AND origin_id = :originId
        """,
        nativeQuery = true,
    )
    fun updateOverride(
        @Param("userId") userId: UUID,
        @Param("metric") metric: String,
        @Param("originId") originId: String,
        @Param("valueSi") valueSi: Double,
        @Param("note") note: String?,
    )

    @Modifying
    @Query(
        value = """
        UPDATE samples SET hidden = true
        WHERE user_id = :userId AND metric = :metric AND origin_id = :originId
        """,
        nativeQuery = true,
    )
    fun hideByOrigin(
        @Param("userId") userId: UUID,
        @Param("metric") metric: String,
        @Param("originId") originId: String,
    )

    @Modifying
    @Query(
        value = """
        INSERT INTO samples (user_id, metric, t, value_si, source, origin_id, hidden, note)
        VALUES (:userId, :metric, :t, :valueSi, 'override', :originId, false, :note)
        ON CONFLICT (user_id, metric, t, source, origin_id)
        DO UPDATE SET value_si = EXCLUDED.value_si, note = EXCLUDED.note, hidden = false
        """,
        nativeQuery = true,
    )
    fun insertOverride(
        @Param("userId") userId: UUID,
        @Param("metric") metric: String,
        @Param("t") t: Instant,
        @Param("valueSi") valueSi: Double,
        @Param("originId") originId: String,
        @Param("note") note: String?,
    )

    @Modifying
    @Query(
        value = """
        UPDATE samples SET hidden = true, note = COALESCE(:note, note)
        WHERE user_id = :userId AND metric = :metric AND origin_id = :originId
        """,
        nativeQuery = true,
    )
    fun hideSample(
        @Param("userId") userId: UUID,
        @Param("metric") metric: String,
        @Param("originId") originId: String,
        @Param("note") note: String?,
    )
}
