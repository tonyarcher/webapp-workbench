package fitnessapi.web

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.env.Environment
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource
import org.springframework.web.filter.CorsFilter

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
 * CORS source for the JSON API. Only the origins named in the env are allowed,
 * and an empty list lets no cross-origin request through. Credentials stay off:
 * the API reads a Bearer JWT, not cookies.
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

/**
 * CORS for the asset-origin-hosted client. This API has no Spring Security, so
 * the source is wired through a servlet `CorsFilter` (which Spring Boot
 * registers automatically) rather than a security `cors()` chain. Empty
 * `CORS_ALLOWED_ORIGINS` (the default) keeps the client same-origin behind the
 * gateway, exactly as before.
 */
@Configuration
class CorsConfig(private val env: Environment) {
    @Bean
    fun corsFilter(): CorsFilter =
        CorsFilter(corsSourceFor(parseAllowedOrigins(env.getProperty("CORS_ALLOWED_ORIGINS"))))
}
