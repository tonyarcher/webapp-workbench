package timesupapi.interests

import org.springframework.stereotype.Service
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.UUID

@Service
class ResolutionService(private val cache: ResolutionCacheRepo) {
    internal var clock: Clock = Clock.systemUTC()
    private val http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build()

    fun resolve(label: String): String? {
        val key = label.trim().lowercase()
        if (key.isEmpty()) return null
        val cached = cache.findByLabelKey(key)
        if (cached != null) return cached.host
        val host = fetchHost(key)
        val row = ResolutionCacheEntity(
            labelKey = key,
            host = host,
            method = "google-news-rss",
            confidence = if (host != null) 0.7 else 0.0,
            lastCheckedAt = clock.instant(),
        )
        cache.save(row)
        return host
    }

    private fun fetchHost(label: String): String? {
        return try {
            val url = "https://news.google.com/rss/search?q=${java.net.URLEncoder.encode(
                label,
                Charsets.UTF_8,
            )}&hl=en-US&gl=US&ceid=US:en"
            val req = HttpRequest.newBuilder(URI.create(url))
                .header("User-Agent", "times-up-server/0.1")
                .timeout(Duration.ofSeconds(15))
                .GET().build()
            val resp = http.send(req, HttpResponse.BodyHandlers.ofString())
            if (resp.statusCode() !in 200..299) return null
            extractHost(resp.body())
        } catch (_: Exception) {
            null
        }
    }

    private fun extractHost(body: String): String? {
        // Look for <source url="..."> in RSS items
        val re = Regex("""<source[^>]*url="([^"]+)"""")
        val match = re.find(body) ?: return null
        val url = match.groupValues[1]
        return try {
            URI(url).host?.lowercase()?.removePrefix("www.")
        } catch (_: Exception) {
            null
        }
    }
}
