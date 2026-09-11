package fitnessapi.store

import java.time.Instant
import java.util.UUID
import javax.sql.DataSource
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.stereotype.Component
import fitnessapi.domain.IncomingSample
import fitnessapi.persist.DailyRollupRepo
import fitnessapi.persist.ImportEntity
import fitnessapi.persist.ImportRepo
import fitnessapi.persist.SampleWriteRepo

@Component
@ConditionalOnBean(DataSource::class)
class SampleWrites(
    private val writes: SampleWriteRepo,
    private val rollups: DailyRollupRepo,
    private val imports: ImportRepo,
) {
    fun applyOverride(userId: UUID, row: StoredSample, valueSi: Double, note: String?) {
        if (row.source == "override") {
            writes.updateOverride(userId, row.metric, row.originId, valueSi, note)
        } else {
            writes.hideByOrigin(userId, row.metric, row.originId)
            writes.insertOverride(
                userId,
                row.metric,
                Instant.ofEpochMilli(row.t),
                valueSi,
                "override:${row.originId}",
                note,
            )
        }
        rebuild(userId, listOf(row.metric))
    }

    fun hideSample(userId: UUID, row: StoredSample, note: String?) {
        writes.hideSample(userId, row.metric, row.originId, note)
        rebuild(userId, listOf(row.metric))
    }

    fun importSamples(
        userId: UUID,
        samples: List<IncomingSample>,
        source: String,
        errorCount: Int,
        errors: List<String>,
    ): ImportResult {
        val row = imports.save(
            ImportEntity(
                userId = userId,
                source = source,
                rowCount = samples.size,
                errorCount = errorCount,
                errors = Json.encodeToString(errors),
            ),
        )
        if (samples.isNotEmpty()) {
            samples.forEach { upsertOne(userId, it) }
            rebuild(userId, samples.map { it.metric }.distinct())
        }
        row.finishedAt = Instant.now()
        imports.save(row)
        return ImportResult(row.id.toString(), samples.size, errorCount, errors)
    }

    private fun upsertOne(userId: UUID, sample: IncomingSample) {
        writes.upsert(
            userId,
            sample.metric,
            Instant.ofEpochMilli(sample.t),
            sample.valueSi,
            sample.source,
            sample.originId,
        )
    }

    private fun rebuild(userId: UUID, metrics: List<String>) {
        if (metrics.isEmpty()) return
        val arr = metrics.toTypedArray()
        rollups.deleteForMetrics(userId, arr)
        rollups.rebuildForMetrics(userId, arr)
    }
}
