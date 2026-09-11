package fitnessapi.http

import java.util.UUID
import fitnessapi.domain.IncomingSample
import fitnessapi.store.LatestPoint
import fitnessapi.store.MetricStats
import fitnessapi.store.SeriesPoint
import fitnessapi.store.StoredSample

internal fun sampleMapKey(userId: UUID, metric: String, t: Long, source: String, originId: String): String =
    "$userId|$metric|$t|$source|$originId"

internal fun upsertIncoming(
    rows: MutableMap<String, StoredSample>,
    userId: UUID,
    sample: IncomingSample,
) {
    val key = sampleMapKey(userId, sample.metric, sample.t, sample.source, sample.originId)
    val prev = rows[key]
    rows[key] = StoredSample(
        userId = userId,
        metric = sample.metric,
        t = sample.t,
        valueSi = sample.valueSi,
        source = sample.source,
        originId = sample.originId,
        hidden = prev?.hidden ?: false,
        note = prev?.note,
    )
}

internal fun visibleStats(rows: Collection<StoredSample>, userId: UUID): List<MetricStats> =
    rows.filter { it.userId == userId && !it.hidden }
        .groupBy { it.metric }
        .toSortedMap()
        .map { (metric, group) ->
            MetricStats(metric, group.size.toLong(), group.minOf { it.t }, group.maxOf { it.t })
        }

internal fun visibleLatest(rows: Collection<StoredSample>, userId: UUID): List<LatestPoint> =
    rows.filter { it.userId == userId && !it.hidden }
        .groupBy { it.metric }
        .toSortedMap()
        .map { (_, group) ->
            val row = group.sortedWith(
                compareByDescending<StoredSample> { it.t }
                    .thenByDescending { it.source == "override" }
                    .thenByDescending { it.valueSi },
            ).first()
            LatestPoint(row.metric, row.t, row.valueSi)
        }

internal fun visibleList(
    rows: Collection<StoredSample>,
    userId: UUID,
    metric: String?,
    from: Long,
    to: Long,
    limit: Int,
): List<StoredSample> = rows.filter {
    it.userId == userId && !it.hidden && it.t >= from && it.t <= to && (metric == null || it.metric == metric)
}.sortedBy { it.t }.take(limit)

internal fun visibleSeries(
    rows: Collection<StoredSample>,
    userId: UUID,
    metric: String,
    from: Long,
    to: Long,
): List<SeriesPoint> = rows.filter {
    it.userId == userId && !it.hidden && it.metric == metric && it.t >= from && it.t <= to
}.sortedBy { it.t }.map { SeriesPoint(it.t, it.valueSi, it.originId, it.source) }
