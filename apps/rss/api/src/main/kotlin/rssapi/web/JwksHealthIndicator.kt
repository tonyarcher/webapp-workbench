package rssapi.web

import org.springframework.boot.health.contributor.Health
import org.springframework.boot.health.contributor.HealthIndicator
import java.io.IOException
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

/**
 * Reports whether the JWKS endpoint is reachable.
 *
 * rss-api is an OAuth2 resource server: it validates every token against keys
 * fetched from user-api. The fetch is lazy and cached, so a down user-api does
 * not show up in the default indicators - the database, disk, and process are
 * all fine while the service can no longer validate a new token. This closes
 * that gap by probing the JWKS endpoint directly.
 */
class JwksHealthIndicator(private val jwksUri: String) : HealthIndicator {
    private val client = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(2))
        .build()

    override fun health(): Health = try {
        val request = HttpRequest.newBuilder()
            .uri(URI.create(jwksUri))
            .timeout(Duration.ofSeconds(3))
            .GET()
            .build()
        val response = client.send(request, HttpResponse.BodyHandlers.discarding())
        if (response.statusCode() in 200..299) {
            Health.up().withDetail("jwks", jwksUri).build()
        } else {
            Health.down()
                .withDetail("jwks", jwksUri)
                .withDetail("httpStatus", response.statusCode())
                .build()
        }
    } catch (e: IOException) {
        // Covers connection refused and read timeout: user-api is down.
        Health.down(e).withDetail("jwks", jwksUri).build()
    } catch (e: InterruptedException) {
        Thread.currentThread().interrupt()
        Health.down(e).withDetail("jwks", jwksUri).build()
    } catch (e: IllegalArgumentException) {
        // A malformed JWKS URI is a config error; report down, not a crash.
        Health.down(e).withDetail("jwks", jwksUri).build()
    }
}
