package calsync.web

import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpHeaders
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
 *
 * Requests whose Origin host matches the request Host skip the allowlist with
 * an allow-this-origin config. Browsers send Origin on every POST, so without
 * the bypass the API's own origin would need allowlisting, and each
 * same-origin deployment (LAN hostnames, IPs, dev ports) would 403 its own
 * writes. Host-only on purpose: TLS terminates at the gateway and containers
 * listen on internal ports, so scheme and port never survive the proxy intact.
 */
internal fun corsSourceFor(origins: List<String>): CorsConfigurationSource {
    val crossOrigin = UrlBasedCorsConfigurationSource()
    crossOrigin.registerCorsConfiguration("/**", apiCorsConfig(origins))
    return object : CorsConfigurationSource {
        override fun getCorsConfiguration(request: HttpServletRequest): CorsConfiguration? {
            val origin: String = request.getHeader(HttpHeaders.ORIGIN)
                ?: return crossOrigin.getCorsConfiguration(request)
            return if (isSameHost(request)) {
                apiCorsConfig(listOf(origin))
            } else {
                crossOrigin.getCorsConfiguration(request)
            }
        }
    }
}

private fun apiCorsConfig(origins: List<String>): CorsConfiguration = CorsConfiguration().apply {
    allowedOrigins = origins
    allowedMethods = listOf("GET", "POST", "PUT", "DELETE", "OPTIONS")
    allowedHeaders = listOf("Authorization", "Content-Type", "X-Api-Version", "X-Request-ID")
    maxAge = CORS_MAX_AGE_SECONDS
}

/** True when the Origin host is the request Host: same-origin behind any proxy. */
internal fun isSameHost(request: HttpServletRequest): Boolean {
    val origin = request.getHeader(HttpHeaders.ORIGIN) ?: return false
    val host = request.getHeader(HttpHeaders.HOST) ?: return false
    return hostOf(origin).equals(hostOf(host), ignoreCase = true)
}

private fun hostOf(value: String): String {
    val authority = value.substringAfter("://", value).substringBefore("/")
    val host = if (authority.startsWith("[")) authority.substringBefore("]") + "]" else authority.substringBefore(":")
    return host.trim().trimEnd('.').lowercase()
}
