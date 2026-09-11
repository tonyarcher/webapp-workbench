package rssapi

import rssapi.log.parseLogLevel

data class Settings(
    val port: Int,
    val databaseUrl: String,
    val logLevel: String,
    val service: String,
    val pollTickMs: Long,
    val pollMaxAgeMs: Long,
    val allowLocalFetch: Boolean,
)

fun settingsFromEnv(env: Map<String, String>): Settings {
    val port = env["PORT"]?.toIntOrNull() ?: 3001
    val databaseUrl = env["DATABASE_URL"].orEmpty()
    val logLevel = parseLogLevel(env["LOG_LEVEL"] ?: "info")
    val service = env["SERVICE"]?.ifBlank { null } ?: "rss-api"
    val pollTickMs = env["POLL_TICK_MS"]?.toLongOrNull() ?: 60_000L
    val pollMaxAgeMs = env["POLL_MAX_AGE_MS"]?.toLongOrNull() ?: (15 * 60_000L)
    val allowLocalFetch = env["RSS_ALLOW_LOCAL_FETCH"] == "1"
    return Settings(port, databaseUrl, logLevel, service, pollTickMs, pollMaxAgeMs, allowLocalFetch)
}

const val POLL_BATCH = 5
const val FETCH_TIMEOUT_MS = 15_000L
const val MAX_FEED_BYTES = 5 * 1024 * 1024
const val MAX_ARTICLES_PER_FEED = 400
const val MAX_CONTENT_BYTES = 256 * 1024
const val PAGE_LIMIT_DEFAULT = 50
const val MAX_BODY_BYTES = 2_000_000
