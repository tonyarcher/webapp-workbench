package userapi

import userapi.domain.parseOrigins
import userapi.domain.validRpId
import userapi.log.parseLogLevel
import java.net.URI

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
    requirePublicOriginAllowed(publicBase, parseOrigins(env["WEBAUTHN_ORIGINS"] ?: error("WEBAUTHN_ORIGINS required")))
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

/**
 * Refuse to start when the origin a browser is sent to is not one WebAuthn accepts.
 *
 * The two settings are configured separately and nothing compared them, so a
 * deployment could sign tokens for one host and allow passkeys on another. That
 * combination boots cleanly and then fails at the passkey prompt with an opaque
 * error, long after the cause.
 *
 * Scope: this catches a MISMATCH between the two values, which is the failure it
 * was added for. It does not catch a self-consistent but insecure origin --
 * OAUTH_PUBLIC_BASE=http://host with WEBAUTHN_ORIGINS=http://host agrees, so this
 * passes, and passkeys still fail because a non-loopback http origin is not a
 * secure context. Detecting that needs a scheme policy, not a comparison, and no
 * such policy exists here.
 */
internal fun requirePublicOriginAllowed(publicBase: String, allowedOrigins: Set<String>) {
    val origin = originOf(publicBase)
    // A default port in an allowed origin is unreachable rather than merely
    // different: the ceremony exact-matches the browser's origin, and a browser
    // never reports one. Failing here names the entry, instead of a service that
    // boots green and then rejects every passkey.
    val unusable = allowedOrigins.filter { isDefaultPortIn(it) }
    if (origin in allowedOrigins && unusable.isEmpty()) return
    // A dev run serves the API on its own port while the allowed origins name the
    // bare loopback host, so the port differs by design. Browsers single out
    // loopback as a secure context, so it stays exempt.
    if (unusable.isEmpty() && isLoopback(origin) && allowedOrigins.any { isLoopback(originOf(it)) }) return
    val detail =
        if (unusable.isEmpty()) {
            ""
        } else {
            " These entries can never match a browser and must drop the port: ${unusable.sorted().joinToString()}."
        }
    throw IllegalArgumentException(
        "OAUTH_PUBLIC_BASE origin '$origin' is not in WEBAUTHN_ORIGINS " +
            "(${allowedOrigins.sorted().joinToString()}). A browser sent to that base " +
            "cannot register or use a passkey.$detail Set one PUBLIC_ORIGIN in " +
            "deploy/.env and derive OAUTH_PUBLIC_BASE and WEBAUTHN_ORIGINS from it.",
    )
}

/** True when a configured origin spells out the port its own scheme already implies. */
private fun isDefaultPortIn(origin: String): Boolean {
    val uri = runCatching { URI(origin) }.getOrNull() ?: return false
    return uri.port >= 0 && isDefaultPort(uri.scheme, uri.port)
}

/**
 * The origin a browser will report for this URL: scheme, host, and a port only
 * when it is not the scheme's default.
 *
 * This must match how user-api's ceremony actually compares origins. RelyingParty
 * is built with allowOriginPort=false and allowOriginSubdomain=false, so
 * OriginMatcher.isAllowed exact-matches the browser's `clientData.origin` string
 * against the raw WEBAUTHN_ORIGINS entries; its URL and port comparison only runs
 * when one of those flags is set, which this service never sets. A browser
 * serialises that origin through the WHATWG URL parser, which drops a default
 * port, so `https://host:443` is reported as `https://host` and never matches a
 * literal ":443" entry.
 *
 * The check therefore folds a default port on the public-base side, and
 * [requirePublicOriginAllowed] separately rejects a default port written into
 * WEBAUTHN_ORIGINS -- which boots with a clear message instead of passing every
 * assertion at the prompt and failing there.
 */
private fun originOf(url: String): String {
    val uri = URI(url)
    val port = if (uri.port < 0 || isDefaultPort(uri.scheme, uri.port)) "" else ":${uri.port}"
    return "${uri.scheme}://${uri.host}$port"
}

private fun isDefaultPort(scheme: String?, port: Int): Boolean =
    (scheme == "https" && port == HTTPS_DEFAULT_PORT) || (scheme == "http" && port == HTTP_DEFAULT_PORT)

private const val HTTPS_DEFAULT_PORT = 443
private const val HTTP_DEFAULT_PORT = 80

/**
 * True for the hosts a browser treats as a secure context without TLS.
 *
 * A host is always present here: both callers pass either a value that already
 * parsed, or an origin built by [originOf].
 */
private fun isLoopback(origin: String): Boolean = URI(origin).host in LOOPBACK_HOSTS

private val LOOPBACK_HOSTS = setOf("localhost", "127.0.0.1", "::1", "[::1]")
