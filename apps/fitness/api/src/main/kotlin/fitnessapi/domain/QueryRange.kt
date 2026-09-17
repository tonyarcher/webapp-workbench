package fitnessapi.domain

const val DEFAULT_SAMPLE_LIMIT: Int = 2_000
const val MAX_SAMPLE_LIMIT: Int = 5_000
const val MAX_IMPORT_ROWS: Int = 2_000
const val SERIES_LTTB_LIMIT: Int = 1_500
const val SERIES_ORIGIN_LIMIT: Int = 80

fun clampLimit(raw: Double?): Int {
    if (raw == null || !raw.isFinite()) return DEFAULT_SAMPLE_LIMIT
    return minOf(MAX_SAMPLE_LIMIT, maxOf(1, raw.toInt()))
}

fun queryMillis(raw: Double?, fallback: Long): Long {
    if (raw == null || !raw.isFinite()) return fallback
    return raw.toLong()
}
