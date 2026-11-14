package rssapi.fetch

import rssapi.FETCH_TIMEOUT_MS
import rssapi.MAX_FEED_BYTES
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

private const val MAX_FETCH_HOPS = 6
private const val MAX_REDIRECTS = 5

/** SSRF-safe HTML page fetcher for on-demand article extraction. */
class HttpPageFetcher(
    private val allowLocal: Boolean,
    private val timeoutMs: Long = FETCH_TIMEOUT_MS,
    private val client: HttpClient = HttpClient.newBuilder()
        .followRedirects(HttpClient.Redirect.NEVER)
        .connectTimeout(Duration.ofMillis(timeoutMs))
        .build(),
) : PageFetcher {

    override fun fetchHtml(url: String): String {
        var current = url
        repeat(MAX_FETCH_HOPS) { hop ->
            checkHost(current)
            val resp = send(current)
            val loc = resp.headers().firstValue("location")
            if (resp.statusCode() in 300..399 && loc.isPresent) {
                if (hop >= MAX_REDIRECTS) throw IllegalStateException("Too many redirects")
                current = URI(current).resolve(loc.get()).toString()
                return@repeat
            }
            return toBody(resp)
        }
        throw IllegalStateException("Too many redirects")
    }

    private fun checkHost(url: String) {
        try {
            assertPublicHost(url, allowLocal)
        } catch (err: java.io.IOException) {
            throw IllegalStateException("unresolvable host", err)
        }
    }

    private fun send(url: String): HttpResponse<ByteArray> {
        val req = HttpRequest.newBuilder(URI.create(url))
            .timeout(Duration.ofMillis(timeoutMs))
            .header(
                "User-Agent",
                "Mozilla/5.0 (compatible; RSSReader/1.0; +https://example.invalid/bot)",
            )
            .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
            .header("Accept-Language", "en-US,en;q=0.9")
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

    private fun toBody(resp: HttpResponse<ByteArray>): String {
        if (resp.statusCode() !in 200..299) throw IllegalStateException("HTTP ${resp.statusCode()}")
        val body = resp.body()
        if (body.size > MAX_FEED_BYTES) throw IllegalStateException("page too large")
        return String(body, charsetOf(resp))
    }

    private fun charsetOf(resp: HttpResponse<ByteArray>): java.nio.charset.Charset {
        val ct = resp.headers().firstValue("content-type").orElse("")
        val m = Regex("charset=([^;\\s]+)", RegexOption.IGNORE_CASE).find(ct)
        val name = m?.groupValues?.get(1)?.trim('"', '\'')
        return runCatching { if (name != null) java.nio.charset.Charset.forName(name) else Charsets.UTF_8 }
            .getOrDefault(Charsets.UTF_8)
    }
}
