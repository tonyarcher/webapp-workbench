package rssapi.fetch
import rssapi.FETCH_TIMEOUT_MS
import rssapi.MAX_FEED_BYTES
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

/** Redirect chasing is bounded; 304/200 are HTTP semantics, not tunables. */
private const val MAX_FETCH_HOPS = 6
private const val MAX_REDIRECTS = 5
private const val NOT_MODIFIED = 304
private const val HTTP_OK = 200

class HttpFeedFetcher(private val allowLocal: Boolean) : FeedFetcher {
    private val client = HttpClient.newBuilder()
        .followRedirects(HttpClient.Redirect.NEVER)
        .connectTimeout(Duration.ofMillis(FETCH_TIMEOUT_MS))
        .build()

    override fun fetch(url: String, etag: String?, lastModified: String?): FetchResult {
        var current = url
        repeat(MAX_FETCH_HOPS) { hop ->
            checkHost(current)
            val resp = send(current, etag, lastModified)
            val loc = resp.headers().firstValue("location")
            if (resp.statusCode() in 300..399 && loc.isPresent) {
                if (hop >= MAX_REDIRECTS) throw IllegalStateException("Too many redirects")
                current = URI(current).resolve(loc.get()).toString()
                return@repeat
            }
            return toResult(resp)
        }
        throw IllegalStateException("Too many redirects")
    }

    private fun checkHost(url: String) {
        try {
            assertPublicHost(url, allowLocal)
        } catch (err: java.io.IOException) {
            // DNS/SSRF check failure (e.g. unresolvable host): same contract
            // as transport failures so callers record it per feed.
            throw IllegalStateException("unresolvable host", err)
        }
    }

    private fun send(url: String, etag: String?, lastModified: String?): HttpResponse<ByteArray> {
        val req = HttpRequest.newBuilder(URI.create(url))
            .timeout(Duration.ofMillis(FETCH_TIMEOUT_MS))
            .header("User-Agent", "rss-reader-server/0.1")
            .header("Accept", "application/rss+xml, application/atom+xml, application/xml, text/xml, */*")
            .apply {
                if (etag != null) header("If-None-Match", etag)
                if (lastModified != null) header("If-Modified-Since", lastModified)
            }
            .GET()
            .build()
        return runCatching { client.send(req, HttpResponse.BodyHandlers.ofByteArray()) }
            .getOrElse { wrapFetch(it) }
    }

    private fun wrapFetch(err: Throwable): HttpResponse<ByteArray> {
        if (err is InterruptedException) Thread.currentThread().interrupt()
        val msg = if (err is java.net.http.HttpTimeoutException) "Request timed out" else err.message
        throw IllegalStateException(msg ?: "fetch failed", err)
    }

    private fun toResult(resp: HttpResponse<ByteArray>): FetchResult {
        val etag = resp.headers().firstValue("etag").orElse(null)
        val lastMod = resp.headers().firstValue("last-modified").orElse(null)
        if (resp.statusCode() == NOT_MODIFIED) return FetchResult(NOT_MODIFIED, etag = etag, lastModified = lastMod)
        if (resp.statusCode() !in 200..299) throw IllegalStateException("HTTP ${resp.statusCode()}")
        val body = resp.body()
        if (body.size > MAX_FEED_BYTES) throw IllegalStateException("feed too large")
        return FetchResult(HTTP_OK, String(body, Charsets.UTF_8), etag, lastMod)
    }
}
