package fitnessapi.store

internal const val STATS_SQL = """
SELECT metric, COUNT(*)::bigint AS n, MIN(t) AS first_t, MAX(t) AS last_t
FROM samples WHERE user_id = ? AND hidden = false
GROUP BY metric
ORDER BY metric
"""

internal const val LATEST_SQL = """
SELECT DISTINCT ON (metric) metric, t, value_si
FROM samples
WHERE user_id = ? AND hidden = false
ORDER BY metric, t DESC, (source = 'override') DESC, value_si DESC
"""

internal const val SAMPLES_SQL = """
SELECT metric, t, value_si, source, origin_id, hidden, note
FROM samples
WHERE user_id = ? AND t >= ? AND t <= ? AND hidden = false
"""

internal const val SERIES_SQL = """
SELECT t, value_si, origin_id, source FROM samples
WHERE user_id = ? AND metric = ? AND t >= ? AND t <= ? AND hidden = false
ORDER BY t ASC
"""

internal const val ROLLUPS_SQL = """
SELECT metric, day, min_si, max_si, avg_si, sum_si, n
FROM daily_rollups WHERE user_id = ?
ORDER BY metric, day
"""

internal const val FIND_ORIGIN_SQL = """
SELECT user_id, metric, t, value_si, origin_id, source, hidden, note
FROM samples
WHERE user_id = ? AND metric = ? AND origin_id = ?
LIMIT 1
"""

internal const val UPDATE_OVERRIDE_SQL = """
UPDATE samples SET value_si = ?, note = ?, hidden = false
WHERE user_id = ? AND metric = ? AND origin_id = ?
"""

internal const val HIDE_ORIGIN_SQL =
    "UPDATE samples SET hidden = true WHERE user_id = ? AND metric = ? AND origin_id = ?"

internal const val INSERT_OVERRIDE_SQL = """
INSERT INTO samples (user_id, metric, t, value_si, source, origin_id, hidden, note)
VALUES (?, ?, ?, ?, 'override', ?, false, ?)
ON CONFLICT (user_id, metric, t, source, origin_id)
DO UPDATE SET value_si = EXCLUDED.value_si, note = EXCLUDED.note, hidden = false
"""

internal const val HIDE_SAMPLE_SQL = """
UPDATE samples SET hidden = true, note = COALESCE(?, note)
WHERE user_id = ? AND metric = ? AND origin_id = ?
"""

internal const val UPSERT_SAMPLE_SQL = """
INSERT INTO samples (user_id, metric, t, value_si, source, origin_id)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT (user_id, metric, t, source, origin_id) DO UPDATE SET value_si = EXCLUDED.value_si
"""

internal const val INSERT_IMPORT_SQL = """
INSERT INTO imports (user_id, source, row_count, error_count, errors)
VALUES (?, ?, ?, ?, ?::jsonb) RETURNING id
"""

internal const val FINISH_IMPORT_SQL = "UPDATE imports SET finished_at = now() WHERE id = ?"

internal const val DELETE_ROLLUPS_SQL =
    "DELETE FROM daily_rollups WHERE user_id = ? AND metric = ANY(?::text[])"

internal const val INSERT_ROLLUPS_SQL = """
INSERT INTO daily_rollups (user_id, metric, day, min_si, max_si, avg_si, sum_si, n)
SELECT user_id, metric, (t AT TIME ZONE 'UTC')::date AS day,
       MIN(value_si), MAX(value_si), AVG(value_si), SUM(value_si), COUNT(*)::int
FROM samples
WHERE user_id = ? AND metric = ANY(?::text[]) AND hidden = false
GROUP BY user_id, metric, (t AT TIME ZONE 'UTC')::date
"""

internal const val GET_PROFILE_SQL = "SELECT * FROM profile WHERE user_id = ?"

internal const val PUT_PROFILE_SQL = """
INSERT INTO profile (user_id, sex, birth_year, height_m, display_unit,
    tm_squat_kg, tm_bench_kg, tm_deadlift_kg, tm_press_kg, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, now())
ON CONFLICT (user_id) DO UPDATE SET
    sex = EXCLUDED.sex,
    birth_year = EXCLUDED.birth_year,
    height_m = EXCLUDED.height_m,
    display_unit = EXCLUDED.display_unit,
    tm_squat_kg = EXCLUDED.tm_squat_kg,
    tm_bench_kg = EXCLUDED.tm_bench_kg,
    tm_deadlift_kg = EXCLUDED.tm_deadlift_kg,
    tm_press_kg = EXCLUDED.tm_press_kg,
    updated_at = now()
"""
