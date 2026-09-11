package fitnessapi.store

import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.Timestamp
import java.time.Instant
import java.util.UUID
import fitnessapi.domain.IncomingSample

internal fun insertSampleRows(conn: Connection, userId: UUID, samples: List<IncomingSample>) {
    conn.prepareStatement(UPSERT_SAMPLE_SQL).use { ps ->
        for (sample in samples) {
            ps.setObject(1, userId)
            ps.setString(2, sample.metric)
            ps.setTimestamp(3, Timestamp.from(Instant.ofEpochMilli(sample.t)))
            ps.setDouble(4, sample.valueSi)
            ps.setString(5, sample.source)
            ps.setString(6, sample.originId)
            ps.addBatch()
        }
        ps.executeBatch()
    }
}

internal fun insertImportRow(
    conn: Connection,
    userId: UUID,
    source: String,
    rowCount: Int,
    errorCount: Int,
    errorsJson: String,
): UUID {
    conn.prepareStatement(INSERT_IMPORT_SQL).use { ps ->
        ps.setObject(1, userId)
        ps.setString(2, source)
        ps.setInt(3, rowCount)
        ps.setInt(4, errorCount)
        ps.setString(5, errorsJson)
        ps.executeQuery().use { rs ->
            check(rs.next()) { "insert import returned no id" }
            return rs.getObject("id", UUID::class.java)
        }
    }
}

internal fun finishImport(conn: Connection, importId: UUID) {
    conn.prepareStatement(FINISH_IMPORT_SQL).use { ps ->
        ps.setObject(1, importId)
        ps.executeUpdate()
    }
}

internal fun hideByOrigin(conn: Connection, userId: UUID, metric: String, originId: String) {
    conn.prepareStatement(HIDE_ORIGIN_SQL).use { ps ->
        ps.setObject(1, userId)
        ps.setString(2, metric)
        ps.setString(3, originId)
        ps.executeUpdate()
    }
}

internal fun updateOverrideRow(
    conn: Connection,
    userId: UUID,
    metric: String,
    originId: String,
    valueSi: Double,
    note: String?,
) {
    conn.prepareStatement(UPDATE_OVERRIDE_SQL).use { ps ->
        ps.setDouble(1, valueSi)
        ps.setString(2, note)
        ps.setObject(3, userId)
        ps.setString(4, metric)
        ps.setString(5, originId)
        ps.executeUpdate()
    }
}

internal fun insertOverrideRow(
    conn: Connection,
    userId: UUID,
    row: StoredSample,
    valueSi: Double,
    note: String?,
) {
    conn.prepareStatement(INSERT_OVERRIDE_SQL).use { ps ->
        ps.setObject(1, userId)
        ps.setString(2, row.metric)
        ps.setTimestamp(3, Timestamp.from(Instant.ofEpochMilli(row.t)))
        ps.setDouble(4, valueSi)
        ps.setString(5, "override:${row.originId}")
        ps.setString(6, note)
        ps.executeUpdate()
    }
}

internal fun hideSampleRow(conn: Connection, userId: UUID, row: StoredSample, note: String?) {
    conn.prepareStatement(HIDE_SAMPLE_SQL).use { ps ->
        ps.setString(1, note)
        ps.setObject(2, userId)
        ps.setString(3, row.metric)
        ps.setString(4, row.originId)
        ps.executeUpdate()
    }
}

internal fun listSql(metric: String?): String =
    if (metric == null) "$SAMPLES_SQL ORDER BY t ASC LIMIT ?"
    else "$SAMPLES_SQL AND metric = ? ORDER BY t ASC LIMIT ?"

internal fun bindRange(ps: PreparedStatement, userId: UUID, from: Long, to: Long) {
    ps.setObject(1, userId)
    ps.setTimestamp(2, Timestamp.from(Instant.ofEpochMilli(from)))
    ps.setTimestamp(3, Timestamp.from(Instant.ofEpochMilli(to)))
}
