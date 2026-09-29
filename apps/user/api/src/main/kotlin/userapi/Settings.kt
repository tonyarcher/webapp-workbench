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
    // No localhost defaults. These are deployment-specific, and a localhost
    // value in production breaks WebAuthn and token validation silently. They
    // are required instead: bootRun provides them for dev, compose for prod.
    val rpId: String,
    val origins: Set<String>,
    val issuer: String,
    /**
     * The base a BROWSER uses to reach this service, gateway prefix included.
     * Required, with no default, for the same reason as rpId: a wrong value here
     * is written into a discovery document and then followed by a real user's
     * browser, so it fails in someone else's session rather than in a test.
     */
    val publicBase: String,
    /**
     * The base other CONTAINERS use to reach this service, and the one published
     * for the server-to-server endpoints in the discovery document.
     *
     * The two cannot be the same value in this deployment. The gateway strips
     * the /user-api prefix, so the public base is unreachable from inside the
     * compose network, while the service name is unreachable from a browser.
     * Defaults to the public base, which is correct for a single-host dev run
     * where nothing crosses the network.
     */
    val internalBase: String = publicBase,
    /**
     * SHA-256 digests of client secrets, keyed by client id. A client listed
     * here is confidential: it may complete a flow without PKCE, and must then
     * authenticate at the token endpoint. Everything else is public and must use
     * PKCE. See ClientSecrets for why the split is necessary.
     *
     * Digests, not the secrets, so this value is not a credential list.
     */
    val clientSecretDigests: Map<String, String> = emptyMap(),
    val loginPath: String = "/auth/",
    /**
     * Whether springdoc publishes the API schema and UI. SecurityConfig reads
     * the same flag, so the security surface cannot disagree with the feature.
     *
     * The truthy set matches Spring's relaxed Boolean binding (true, on, yes,
     * 1), because a mismatch would let the two sides resolve differently.
     * `on` in particular was missing at first, and it fails closed: docs are
     * reachable but answer 401 rather than being public.
     *
     * This is a convenience alias, not the only route to enabled docs. Setting
     * `springdoc.api-docs.enabled` directly also turns them on, and then the
     * endpoints exist but answer 401 here. That is the safe direction.
     *
     * Defaults to false: the schema is not public.
     */
    val swaggerEnabled: Boolean = false,
)

fun settingsFromEnv(env: Map<String, String>): Settings {
    val port = env["PORT"]?.toIntOrNull() ?: 3000
    val cookieSecure = env["COOKIE_SECURE"]?.trim()?.lowercase() in setOf("1", "true", "yes", "on")
    val (publicBase, internalBase) = oauthBases(env)
    return Settings(
        port,
        env["DATABASE_URL"].orEmpty(),
        parseLogLevel(env["LOG_LEVEL"] ?: "info"),
        env["SERVICE"]?.ifBlank { null } ?: "user-api",
        cookieSecure,
        validRpId(env["WEBAUTHN_RP_ID"] ?: error("WEBAUTHN_RP_ID required")),
        parseOrigins(env["WEBAUTHN_ORIGINS"] ?: error("WEBAUTHN_ORIGINS required")),
        env["OAUTH_ISSUER"] ?: error("OAUTH_ISSUER required"),
        publicBase,
        internalBase,
        clientSecretDigests(env),
        env["LOGIN_PATH"] ?: "/auth/",
        env["SWAGGER_ENABLED"]?.trim()?.lowercase() in setOf("1", "true", "yes", "on"),
    )
}

/**
 * Client secrets, as `client_id=sha256hex` pairs separated by commas.
 *
 * Parsed rather than trusted wholesale: a malformed entry fails at boot instead
 * of silently leaving one client public, which would downgrade it without any
 * sign that it happened.
 */
private fun clientSecretDigests(env: Map<String, String>): Map<String, String> {
    val raw = env["OAUTH_CLIENT_SECRETS"].orEmpty().trim()
    if (raw.isEmpty()) return emptyMap()
    val out = mutableMapOf<String, String>()
    for (entry in raw.split(',')) {
        val pair = entry.trim()
        if (pair.isEmpty()) continue
        val id = pair.substringBefore('=').trim()
        val digest = pair.substringAfter('=', "").trim()
        require(id.isNotEmpty() && digest.length == SHA256_HEX_CHARS && isLowerHex(digest)) {
            "OAUTH_CLIENT_SECRETS: expected client_id=<$SHA256_HEX_CHARS hex sha256>, " +
                "got '${pair.take(REDACT_CHARS)}'"
        }
        out[id] = digest
    }
    return out
}

/** A SHA-256 digest rendered as lowercase hex: 64 characters. */
private const val SHA256_HEX_CHARS = 64

/** How much of a malformed entry is echoed back in the boot error. */
private const val REDACT_CHARS = 24

private fun isLowerHex(value: String): Boolean = value.all { it in "0123456789abcdef" }

/**
 * The public and internal bases, trailing slashes trimmed because endpoints are
 * appended to them and a doubled slash is a 404 in someone else's browser.
 *
 * internalBase defaults to the public one, which is right for a dev run where
 * nothing crosses the network, and wrong for a deployment behind the gateway --
 * which is why compose sets it explicitly rather than relying on the default.
 */
private fun oauthBases(env: Map<String, String>): Pair<String, String> {
    val public = trimSlash(env["OAUTH_PUBLIC_BASE"] ?: error("OAUTH_PUBLIC_BASE required"))
    return public to trimSlash(env["OAUTH_INTERNAL_BASE"] ?: public)
}

private fun trimSlash(value: String): String = value.trim().trimEnd('/')
