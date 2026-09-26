package userapi

/**
 * Test helpers for Settings.
 *
 * The application source carries no localhost default for the deployment-specific
 * values; these helpers exist because WebAuthn tests need a localhost origin and
 * the settings tests need the required env vars. They live here, in the test
 * source set, so no localhost literal reaches a non-test .kt file.
 */
fun settingsForTest(
    port: Int = 3000,
    databaseUrl: String = "",
    logLevel: String = "error",
    service: String = "user-api",
    cookieSecure: Boolean = false,
    swaggerEnabled: Boolean = false,
): Settings = Settings(
    port,
    databaseUrl,
    logLevel,
    service,
    cookieSecure,
    rpId = "localhost",
    origins = setOf("http://localhost", "http://127.0.0.1"),
    issuer = "http://localhost/user-api",
    swaggerEnabled = swaggerEnabled,
)

/** The env vars Settings now requires, for settingsFromEnv calls in tests. */
fun requiredEnv(): Map<String, String> = mapOf(
    "WEBAUTHN_RP_ID" to "localhost",
    "WEBAUTHN_ORIGINS" to "http://localhost,http://127.0.0.1",
    "OAUTH_ISSUER" to "http://localhost/user-api",
)
