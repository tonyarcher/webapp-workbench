package userapi

import userapi.log.parseLogLevel

data class Settings(
    val port: Int,
    val databaseUrl: String,
    val logLevel: String,
    val service: String,
)

fun settingsFromEnv(env: Map<String, String>): Settings {
    val port = env["PORT"]?.toIntOrNull() ?: 3000
    val databaseUrl = env["DATABASE_URL"].orEmpty()
    val logLevel = parseLogLevel(env["LOG_LEVEL"] ?: "info")
    val service = env["SERVICE"]?.ifBlank { null } ?: "user-api"
    return Settings(port, databaseUrl, logLevel, service)
}
