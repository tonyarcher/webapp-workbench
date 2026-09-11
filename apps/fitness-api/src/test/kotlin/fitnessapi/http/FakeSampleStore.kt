package fitnessapi.http

import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import fitnessapi.domain.IncomingSample
import fitnessapi.store.ImportResult
import fitnessapi.store.LatestPoint
import fitnessapi.store.MetricStats
import fitnessapi.store.RollupRow
import fitnessapi.store.SampleStore
import fitnessapi.store.SeriesPoint
import fitnessapi.store.StoredSample

class FakeSampleStore : SampleStore {
    private val rows = ConcurrentHashMap<String, StoredSample>()
    private val rollupRows = ConcurrentHashMap<RollupKey, RollupRow>()

    override fun stats(userId: UUID): List<MetricStats> = visibleStats(rows.values, userId)

    override fun latest(userId: UUID): List<LatestPoint> = visibleLatest(rows.values, userId)

    override fun listSamples(
        userId: UUID,
        metric: String?,
        from: Long,
        to: Long,
        limit: Int,
    ): List<StoredSample> = visibleList(rows.values, userId, metric, from, to, limit)

    override fun seriesRows(userId: UUID, metric: String, from: Long, to: Long): List<SeriesPoint> =
        visibleSeries(rows.values, userId, metric, from, to)

    override fun rollups(userId: UUID): List<RollupRow> =
        rollupRows.filter { it.key.userId == userId }.values.sortedWith(
            compareBy({ it.metric }, { it.day }),
        )

    override fun findByOrigin(userId: UUID, metric: String, originId: String): StoredSample? =
        rows.values.firstOrNull { it.userId == userId && it.metric == metric && it.originId == originId }

    override fun applyOverride(userId: UUID, row: StoredSample, valueSi: Double, note: String?) {
        if (row.source == "override") {
            put(row.copy(valueSi = valueSi, note = note, hidden = false))
        } else {
            put(row.copy(hidden = true))
            put(
                row.copy(
                    source = "override",
                    originId = "override:${row.originId}",
                    valueSi = valueSi,
                    note = note,
                    hidden = false,
                ),
            )
        }
        rebuildFakeRollups(rows.values, userId, listOf(row.metric), rollupRows)
    }

    override fun hideSample(userId: UUID, row: StoredSample, note: String?) {
        put(row.copy(hidden = true, note = note ?: row.note))
        rebuildFakeRollups(rows.values, userId, listOf(row.metric), rollupRows)
    }

    override fun importSamples(
        userId: UUID,
        samples: List<IncomingSample>,
        source: String,
        errorCount: Int,
        errors: List<String>,
    ): ImportResult {
        samples.forEach { upsertIncoming(rows, userId, it) }
        rebuildFakeRollups(rows.values, userId, samples.map { it.metric }.distinct(), rollupRows)
        return ImportResult(UUID.randomUUID().toString(), samples.size, errorCount, errors)
    }

    fun clear() {
        rows.clear()
        rollupRows.clear()
    }

    private fun put(row: StoredSample) {
        rows[sampleMapKey(row.userId, row.metric, row.t, row.source, row.originId)] = row
    }
}
