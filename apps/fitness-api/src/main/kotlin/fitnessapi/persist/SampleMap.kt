package fitnessapi.persist

import fitnessapi.store.LatestPoint
import fitnessapi.store.MetricStats
import fitnessapi.store.RollupRow
import fitnessapi.store.SeriesPoint
import fitnessapi.store.StoredSample

fun SampleEntity.toStored(): StoredSample = StoredSample(
    userId = userId,
    metric = metric,
    t = t.toEpochMilli(),
    valueSi = valueSi,
    source = source,
    originId = originId,
    hidden = hidden,
    note = note,
)

fun SampleEntity.toSeries(): SeriesPoint =
    SeriesPoint(t.toEpochMilli(), valueSi, originId, source)

fun MetricStatsView.toStats(): MetricStats =
    MetricStats(getMetric(), getN(), getFirstT().toEpochMilli(), getLastT().toEpochMilli())

fun LatestView.toLatest(): LatestPoint =
    LatestPoint(getMetric(), getT().toEpochMilli(), getValueSi())

fun DailyRollupEntity.toRow(): RollupRow =
    RollupRow(metric, day.toString(), minSi, maxSi, avgSi, sumSi, n)
