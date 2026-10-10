package stockgame.web

import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource

/** How long a browser may cache a preflight response, in seconds. */
private const val CORS_MAX_AGE_SECONDS: Long = 3600

/**
 * Allowed origins from a comma/whitespace-separated value. Empty when the
 * value is null or blank, which is the same-origin-only default: the client's
 * static assets live on the API origin until `CORS_ALLOWED_ORIGINS` names the
 * asset origin they move to.
 */
internal fun parseAllowedOrigins(raw: String?): List<String> =
    raw.orEmpty().split(',', ' ', '\t', '\n').map { it.trim() }.filter { it.isNotEmpty() }

/**
 * CORS source for the JSON API. The client authenticates with a Bearer JWT, not
 * cookies, so credentials stay off; only the origins named in the env are
 * allowed, and an empty list lets no cross-origin request through.
 */
internal fun corsSourceFor(origins: List<String>): CorsConfigurationSource {
    val config = CorsConfiguration().apply {
        allowedOrigins = origins
        allowedMethods = listOf("GET", "POST", "PUT", "DELETE", "OPTIONS")
        allowedHeaders = listOf("Authorization", "Content-Type", "X-Api-Version", "X-Request-ID")
        maxAge = CORS_MAX_AGE_SECONDS
    }
    val source = UrlBasedCorsConfigurationSource()
    source.registerCorsConfiguration("/**", config)
    return source
}
