package fitnessapi.store

import java.sql.Timestamp
import java.time.Instant
import java.util.UUID
import javax.sql.DataSource
import fitnessapi.domain.IncomingSample
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class JdbcSampleStore(private val dataSource: DataSource) : SampleStore {
    override fun stats(userId: UUID): List<MetricStats> = dataSource.withConn { conn ->
        conn.prepareStatement(STATS_SQL).use { ps ->
            ps.setObject(1, userId)
            ps.executeQuery().use { rs -> rs.mapRows(::readStats) }
        }
    }

    override fun latest(userId: UUID): List<LatestPoint> = dataSource.withConn { conn ->
        conn.prepareStatement(LATEST_SQL).use { ps ->
            ps.setObject(1, userId)
            ps.executeQuery().use { rs -> rs.mapRows(::readLatest) }
        }
    }

    override fun listSamples(
        userId: UUID,
        metric: String?,
        from: Long,
        to: Long,
        limit: Int,
    ): List<StoredSample> = dataSource.withConn { conn ->
        conn.prepareStatement(listSql(metric)).use { ps ->
            bindRange(ps, userId, from, to)
            if (metric == null) ps.setInt(4, limit) else {
                ps.setString(4, metric)
                ps.setInt(5, limit)
            }
            ps.executeQuery().use { rs -> rs.mapRows(::readStoredSample) }
        }
    }

    override fun seriesRows(userId: UUID, metric: String, from: Long, to: Long): List<SeriesPoint> =
        dataSource.withConn { conn ->
            conn.prepareStatement(SERIES_SQL).use { ps ->
                ps.setObject(1, userId)
                ps.setString(2, metric)
                ps.setTimestamp(3, Timestamp.from(Instant.ofEpochMilli(from)))
                ps.setTimestamp(4, Timestamp.from(Instant.ofEpochMilli(to)))
                ps.executeQuery().use { rs -> rs.mapRows(::readSeries) }
            }
        }

    override fun rollups(userId: UUID): List<RollupRow> = dataSource.withConn { conn ->
        conn.prepareStatement(ROLLUPS_SQL).use { ps ->
            ps.setObject(1, userId)
            ps.executeQuery().use { rs -> rs.mapRows(::readRollup) }
        }
    }

    override fun findByOrigin(userId: UUID, metric: String, originId: String): StoredSample? =
        dataSource.withConn { conn ->
            conn.prepareStatement(FIND_ORIGIN_SQL).use { ps ->
                ps.setObject(1, userId)
                ps.setString(2, metric)
                ps.setString(3, originId)
                ps.executeQuery().use { rs -> if (rs.next()) readStoredSample(rs) else null }
            }
        }

    override fun applyOverride(userId: UUID, row: StoredSample, valueSi: Double, note: String?) {
        dataSource.withTx { conn ->
            if (row.source == "override") {
                updateOverrideRow(conn, userId, row.metric, row.originId, valueSi, note)
            } else {
                hideByOrigin(conn, userId, row.metric, row.originId)
                insertOverrideRow(conn, userId, row, valueSi, note)
            }
            rebuildRollups(conn, userId, listOf(row.metric))
        }
    }

    override fun hideSample(userId: UUID, row: StoredSample, note: String?) {
        dataSource.withTx { conn ->
            hideSampleRow(conn, userId, row, note)
            rebuildRollups(conn, userId, listOf(row.metric))
        }
    }

    override fun importSamples(
        userId: UUID,
        samples: List<IncomingSample>,
        source: String,
        errorCount: Int,
        errors: List<String>,
    ): ImportResult = dataSource.withTx { conn ->
        val id = insertImportRow(conn, userId, source, samples.size, errorCount, Json.encodeToString(errors))
        if (samples.isNotEmpty()) {
            insertSampleRows(conn, userId, samples)
            rebuildRollups(conn, userId, samples.map { it.metric }.distinct())
        }
        finishImport(conn, id)
        ImportResult(id.toString(), samples.size, errorCount, errors)
    }
}
