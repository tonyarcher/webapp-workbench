package userapi

import userapi.domain.parseOrigins
import userapi.domain.validRpId
import userapi.log.parseLogLevel

data class Settings(
    val port: Int,
    val databaseUrl: String,
    val logLevel: String,
    val service: String,
    val cookieSecure: Boolean = false,
    val rpId: String = "localhost",
    val origins: Set<String> = setOf("http://localhost", "http://127.0.0.1"),
    val issuer: String = "http://localhost/user-api",
    val loginPath: String = "/auth/",
)

fun settingsFromEnv(env: Map<String, String>): Settings {
    val port = env["PORT"]?.toIntOrNull() ?: 3000
    val databaseUrl = env["DATABASE_URL"].orEmpty()
    val logLevel = parseLogLevel(env["LOG_LEVEL"] ?: "info")
    val service = env["SERVICE"]?.ifBlank { null } ?: "user-api"
    val cookieSecure = env["COOKIE_SECURE"]?.lowercase() in setOf("1", "true", "yes")
    val rpId = validRpId(env["WEBAUTHN_RP_ID"] ?: "localhost")
    val origins = parseOrigins(env["WEBAUTHN_ORIGINS"] ?: "http://localhost,http://127.0.0.1")
        .ifEmpty { setOf("http://localhost") }
    val issuer = env["OAUTH_ISSUER"] ?: "http://localhost/user-api"
    val loginPath = env["LOGIN_PATH"] ?: "/auth/"
    return Settings(port, databaseUrl, logLevel, service, cookieSecure, rpId, origins, issuer, loginPath)
}
