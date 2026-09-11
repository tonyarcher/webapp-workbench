package fitnessapi.store

import java.util.UUID
import fitnessapi.domain.IncomingSample

data class StoredSample(
    val userId: UUID,
    val metric: String,
    val t: Long,
    val valueSi: Double,
    val source: String,
    val originId: String,
    val hidden: Boolean,
    val note: String?,
)

data class MetricStats(val metric: String, val n: Long, val firstT: Long, val lastT: Long)

data class LatestPoint(val metric: String, val t: Long, val valueSi: Double)

data class RollupRow(
    val metric: String,
    val day: String,
    val minSi: Double?,
    val maxSi: Double?,
    val avgSi: Double?,
    val sumSi: Double?,
    val n: Int,
)

data class SeriesPoint(val t: Long, val valueSi: Double, val originId: String, val source: String)

data class ImportResult(
    val importId: String?,
    val stored: Int,
    val skipped: Int,
    val errors: List<String>,
)

interface SampleStore {
    fun stats(userId: UUID): List<MetricStats>
    fun latest(userId: UUID): List<LatestPoint>
    fun listSamples(userId: UUID, metric: String?, from: Long, to: Long, limit: Int): List<StoredSample>
    fun seriesRows(userId: UUID, metric: String, from: Long, to: Long): List<SeriesPoint>
    fun rollups(userId: UUID): List<RollupRow>
    fun findByOrigin(userId: UUID, metric: String, originId: String): StoredSample?
    fun applyOverride(userId: UUID, row: StoredSample, valueSi: Double, note: String?)
    fun hideSample(userId: UUID, row: StoredSample, note: String?)
    fun importSamples(
        userId: UUID,
        samples: List<IncomingSample>,
        source: String,
        errorCount: Int,
        errors: List<String>,
    ): ImportResult
}
