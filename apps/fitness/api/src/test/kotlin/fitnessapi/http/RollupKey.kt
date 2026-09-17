package fitnessapi.http

import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import fitnessapi.store.RollupRow
import fitnessapi.store.StoredSample

internal data class RollupKey(val userId: UUID, val metric: String, val day: String)

internal fun utcDay(tMillis: Long): String =
    Instant.ofEpochMilli(tMillis).atZone(ZoneOffset.UTC).toLocalDate().toString()

internal fun rebuildFakeRollups(
    samples: Collection<StoredSample>,
    userId: UUID,
    metrics: List<String>,
    rollups: MutableMap<RollupKey, RollupRow>,
) {
    for (metric in metrics) {
        rollups.keys.filter { it.userId == userId && it.metric == metric }.forEach { rollups.remove(it) }
        val groups = samples.filter { it.userId == userId && it.metric == metric && !it.hidden }
            .groupBy { utcDay(it.t) }
        for ((day, rows) in groups) {
            val values = rows.map { it.valueSi }
            rollups[RollupKey(userId, metric, day)] = RollupRow(
                metric = metric,
                day = day,
                minSi = values.min(),
                maxSi = values.max(),
                avgSi = values.average(),
                sumSi = values.sum(),
                n = values.size,
            )
        }
    }
}
