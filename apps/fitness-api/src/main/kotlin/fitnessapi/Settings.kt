package fitnessapi

import fitnessapi.log.parseLogLevel
import java.util.UUID

val LOCAL_USER_ID: UUID = UUID.fromString("00000000-0000-4000-8000-000000000001")

data class Settings(
    val port: Int,
    val databaseUrl: String,
    val logLevel: String,
    val service: String,
)

fun settingsFromEnv(env: Map<String, String>): Settings {
    val port = env["PORT"]?.toIntOrNull() ?: 3003
    val databaseUrl = env["DATABASE_URL"].orEmpty()
    val logLevel = parseLogLevel(env["LOG_LEVEL"] ?: "info")
    val service = env["SERVICE"]?.ifBlank { null } ?: "fitness-api"
    return Settings(port, databaseUrl, logLevel, service)
}
