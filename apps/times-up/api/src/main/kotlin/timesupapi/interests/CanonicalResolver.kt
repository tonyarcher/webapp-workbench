package timesupapi.interests

import org.springframework.stereotype.Service
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

@Service
class CanonicalResolver {
    private val http = HttpClient.newBuilder()
        .followRedirects(HttpClient.Redirect.NORMAL)
        .connectTimeout(Duration.ofSeconds(10))
        .build()

    fun resolve(rawUrl: String): String? = try {
        val req = HttpRequest.newBuilder(URI.create(rawUrl))
            .header("User-Agent", "times-up-server/0.1")
            .timeout(Duration.ofSeconds(15))
            .method("HEAD", HttpRequest.BodyPublishers.noBody())
            .build()
        val resp = http.send(req, HttpResponse.BodyHandlers.discarding())
        val final = resp.uri().toString()
        normalize(final)
    } catch (_: Exception) {
        null
    }

    private fun normalize(url: String): String? {
        return try {
            val u = URI(url)
            val host = u.host?.lowercase()?.removePrefix("www.") ?: return null
            val path = u.path?.trimEnd('/') ?: ""
            "https://$host$path"
        } catch (_: Exception) {
            null
        }
    }
}
