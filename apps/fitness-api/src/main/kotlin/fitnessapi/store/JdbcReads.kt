package fitnessapi.store

import java.sql.ResultSet
import java.util.UUID
import fitnessapi.domain.ProfileData

internal fun readStoredSample(rs: ResultSet): StoredSample = StoredSample(
    userId = rs.getObject("user_id", UUID::class.java),
    metric = rs.getString("metric"),
    t = rs.getTimestamp("t").toInstant().toEpochMilli(),
    valueSi = rs.getDouble("value_si"),
    source = rs.getString("source"),
    originId = rs.getString("origin_id"),
    hidden = rs.getBoolean("hidden"),
    note = rs.getString("note"),
)

internal fun readStats(rs: ResultSet): MetricStats = MetricStats(
    metric = rs.getString("metric"),
    n = rs.getLong("n"),
    firstT = rs.getTimestamp("first_t").toInstant().toEpochMilli(),
    lastT = rs.getTimestamp("last_t").toInstant().toEpochMilli(),
)

internal fun readLatest(rs: ResultSet): LatestPoint = LatestPoint(
    metric = rs.getString("metric"),
    t = rs.getTimestamp("t").toInstant().toEpochMilli(),
    valueSi = rs.getDouble("value_si"),
)

internal fun readSeries(rs: ResultSet): SeriesPoint = SeriesPoint(
    t = rs.getTimestamp("t").toInstant().toEpochMilli(),
    valueSi = rs.getDouble("value_si"),
    originId = rs.getString("origin_id"),
    source = rs.getString("source"),
)

internal fun readRollup(rs: ResultSet): RollupRow = RollupRow(
    metric = rs.getString("metric"),
    day = rs.getDate("day").toLocalDate().toString(),
    minSi = rs.doubleOrNull("min_si"),
    maxSi = rs.doubleOrNull("max_si"),
    avgSi = rs.doubleOrNull("avg_si"),
    sumSi = rs.doubleOrNull("sum_si"),
    n = rs.getInt("n"),
)

internal fun readProfile(rs: ResultSet): ProfileData = ProfileData(
    sex = rs.getString("sex"),
    birthYear = rs.intOrNull("birth_year"),
    heightM = rs.doubleOrNull("height_m"),
    displayUnit = if (rs.getString("display_unit") == "lb") "lb" else "kg",
    tmSquat = rs.doubleOrNull("tm_squat_kg"),
    tmBench = rs.doubleOrNull("tm_bench_kg"),
    tmDeadlift = rs.doubleOrNull("tm_deadlift_kg"),
    tmPress = rs.doubleOrNull("tm_press_kg"),
)

internal fun ResultSet.doubleOrNull(column: String): Double? {
    val value = getDouble(column)
    return if (wasNull()) null else value
}

internal fun ResultSet.intOrNull(column: String): Int? {
    val value = getInt(column)
    return if (wasNull()) null else value
}

internal fun <T> ResultSet.mapRows(read: (ResultSet) -> T): List<T> {
    val out = mutableListOf<T>()
    while (next()) out.add(read(this))
    return out
}
