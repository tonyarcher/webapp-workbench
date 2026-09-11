package fitnessapi.store

import java.time.Instant
import java.util.UUID
import javax.sql.DataSource
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import fitnessapi.domain.IncomingSample
import fitnessapi.persist.DailyRollupRepo
import fitnessapi.persist.SampleRepo
import fitnessapi.persist.toLatest
import fitnessapi.persist.toRow
import fitnessapi.persist.toSeries
import fitnessapi.persist.toStats
import fitnessapi.persist.toStored

@Service
@ConditionalOnBean(DataSource::class)
class JpaSampleStore(
    private val samples: SampleRepo,
    private val writes: SampleWrites,
    private val rollupsRepo: DailyRollupRepo,
) : SampleStore {
    override fun stats(userId: UUID): List<MetricStats> = samples.stats(userId).map { it.toStats() }

    override fun latest(userId: UUID): List<LatestPoint> = samples.latest(userId).map { it.toLatest() }

    override fun listSamples(
        userId: UUID,
        metric: String?,
        from: Long,
        to: Long,
        limit: Int,
    ): List<StoredSample> = samples.listVisible(
        userId,
        metric,
        Instant.ofEpochMilli(from),
        Instant.ofEpochMilli(to),
        PageRequest.of(0, limit),
    ).map { it.toStored() }

    override fun seriesRows(userId: UUID, metric: String, from: Long, to: Long): List<SeriesPoint> =
        samples.seriesRows(userId, metric, Instant.ofEpochMilli(from), Instant.ofEpochMilli(to))
            .map { it.toSeries() }

    override fun rollups(userId: UUID): List<RollupRow> =
        rollupsRepo.findByUserIdOrderByMetricAscDayAsc(userId).map { it.toRow() }

    override fun findByOrigin(userId: UUID, metric: String, originId: String): StoredSample? =
        samples.findByUserIdAndMetricAndOriginId(userId, metric, originId)?.toStored()

    @Transactional
    override fun applyOverride(userId: UUID, row: StoredSample, valueSi: Double, note: String?) {
        writes.applyOverride(userId, row, valueSi, note)
    }

    @Transactional
    override fun hideSample(userId: UUID, row: StoredSample, note: String?) {
        writes.hideSample(userId, row, note)
    }

    @Transactional
    override fun importSamples(
        userId: UUID,
        samples: List<IncomingSample>,
        source: String,
        errorCount: Int,
        errors: List<String>,
    ): ImportResult = writes.importSamples(userId, samples, source, errorCount, errors)
}
