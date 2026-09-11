package userapi

import userapi.log.parseLogLevel

data class Settings(
    val port: Int,
    val databaseUrl: String,
    val logLevel: String,
    val service: String,
    val cookieSecure: Boolean = false,
)

fun settingsFromEnv(env: Map<String, String>): Settings {
    val port = env["PORT"]?.toIntOrNull() ?: 3000
    val databaseUrl = env["DATABASE_URL"].orEmpty()
    val logLevel = parseLogLevel(env["LOG_LEVEL"] ?: "info")
    val service = env["SERVICE"]?.ifBlank { null } ?: "user-api"
    val cookieSecure = env["COOKIE_SECURE"]?.lowercase() in setOf("1", "true", "yes")
    return Settings(port, databaseUrl, logLevel, service, cookieSecure)
}
