package fitnessapi.http

import kotlinx.serialization.Serializable
import fitnessapi.domain.Point
import fitnessapi.store.LatestPoint
import fitnessapi.store.MetricStats
import fitnessapi.store.RollupRow
import fitnessapi.store.SeriesPoint
import fitnessapi.store.StoredSample

@Serializable
data class StatsJson(val metrics: List<MetricStatJson>)

@Serializable
data class MetricStatJson(val metric: String, val n: Long, val firstT: Long, val lastT: Long)

@Serializable
data class LatestJson(val latest: List<LatestSampleJson>)

@Serializable
data class LatestSampleJson(val metric: String, val t: Long, val valueSi: Double)

@Serializable
data class SamplesJson(val samples: List<SampleRowJson>)

@Serializable
data class SampleRowJson(
    val metric: String,
    val t: Long,
    val valueSi: Double,
    val source: String,
    val originId: String,
    val hidden: Boolean,
    val note: String?,
)

@Serializable
data class RollupsJson(val rollups: List<RollupJson>)

@Serializable
data class RollupJson(
    val metric: String,
    val day: String,
    val minSi: Double?,
    val maxSi: Double?,
    val avgSi: Double?,
    val sumSi: Double?,
    val n: Int,
)

@Serializable
data class SeriesJson(
    val metric: String,
    val points: List<PointJson>,
    val n: Int,
    val origins: List<OriginJson>,
)

@Serializable
data class PointJson(val t: Long, val v: Double)

@Serializable
data class OriginJson(val t: Long, val valueSi: Double, val originId: String, val source: String)

@Serializable
data class ImportJson(
    val importId: String? = null,
    val stored: Int,
    val skipped: Int,
    val errors: List<String>,
)

@Serializable
data class OkOverridden(val ok: Boolean, val overridden: Boolean)

@Serializable
data class OkHidden(val ok: Boolean, val hidden: Boolean)

fun MetricStats.toJson(): MetricStatJson = MetricStatJson(metric, n, firstT, lastT)

fun LatestPoint.toJson(): LatestSampleJson = LatestSampleJson(metric, t, valueSi)

fun StoredSample.toJson(): SampleRowJson =
    SampleRowJson(metric, t, valueSi, source, originId, hidden, note)

fun RollupRow.toJson(): RollupJson = RollupJson(metric, day, minSi, maxSi, avgSi, sumSi, n)

fun Point.toJson(): PointJson = PointJson(t, v)

fun SeriesPoint.toOrigin(): OriginJson = OriginJson(t, valueSi, originId, source)
