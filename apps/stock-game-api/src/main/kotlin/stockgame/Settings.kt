package stockgame

import stockgame.log.parseLogLevel

data class Settings(
    val port: Int,
    val databaseUrl: String,
    val logLevel: String,
    val service: String,
    val provider: String,
    val quoteTtlMs: Long,
)

fun settingsFromEnv(env: Map<String, String>): Settings {
    val port = env["PORT"]?.toIntOrNull() ?: 3004
    val databaseUrl = env["DATABASE_URL"].orEmpty()
    val logLevel = parseLogLevel(env["LOG_LEVEL"] ?: "info")
    val service = env["SERVICE"]?.ifBlank { null } ?: "stock-game-api"
    val provider = env["PRICE_PROVIDER"]?.ifBlank { null } ?: "yahoo"
    val quoteTtlMs = env["QUOTE_TTL_MS"]?.toLongOrNull()?.takeIf { it >= 0 } ?: (15 * 60_000L)
    return Settings(port, databaseUrl, logLevel, service, provider, quoteTtlMs)
}
