package timesupapi.fetch

import timesupapi.platform.FETCH_TIMEOUT_MS
import timesupapi.platform.MAX_FEED_BYTES
import java.io.IOException
import java.net.URI
import java.nio.charset.Charset

private const val MAX_FETCH_HOPS = 6
private const val MAX_REDIRECTS = 5

/** SSRF-safe HTML page fetcher with pinned DNS and a streaming byte limit. */
class HttpPageFetcher(private val allowLocal: Boolean, private val timeoutMs: Long = FETCH_TIMEOUT_MS) : PageFetcher {
    private val resolver = PublicDnsResolver(allowLocal)

    override fun fetchHtml(url: String): String {
        var current = url
        repeat(MAX_FETCH_HOPS) { hop ->
            val resp = send(
                current,
                mapOf(
                    "User-Agent" to "Mozilla/5.0 (compatible; TimesUp/1.0; +https://example.invalid/bot)",
                    "Accept" to "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language" to "en-US,en;q=0.9",
                ),
            )
            val loc = resp.headers["location"]?.firstOrNull()
            if (resp.status in 300..399 && loc != null) {
                current = redirectTarget(current, loc, hop)
                return@repeat
            }
            return toBody(resp)
        }
        throw IllegalStateException("Too many redirects")
    }

    private fun redirectTarget(current: String, location: String, hop: Int): String {
        if (hop >= MAX_REDIRECTS) throw IllegalStateException("Too many redirects")
        return runCatching { URI(current).resolve(location).toString() }
            .getOrElse { throw IllegalStateException("Bad redirect", it) }
    }

    private fun send(url: String, headers: Map<String, String>): PinnedResponse = try {
        sendPinned(url, resolver, timeoutMs, headers, MAX_FEED_BYTES)
    } catch (err: IllegalArgumentException) {
        throw IllegalStateException(err.message ?: "fetch failed", err)
    } catch (err: IOException) {
        throw wrapFetch(err)
    }

    private fun toBody(resp: PinnedResponse): String {
        if (resp.status !in 200..299) throw IllegalStateException("HTTP ${resp.status}")
        return String(resp.body, charsetOf(resp))
    }

    private fun charsetOf(resp: PinnedResponse): Charset {
        val ct = resp.headers["content-type"]?.firstOrNull().orEmpty()
        val name = Regex("charset=([^;\\s]+)", RegexOption.IGNORE_CASE).find(ct)?.groupValues?.get(1)?.trim('"', '\'')
        return runCatching { if (name != null) Charset.forName(name) else Charsets.UTF_8 }.getOrDefault(Charsets.UTF_8)
    }

    private fun wrapFetch(err: IOException): IllegalStateException {
        if (err is BodyTooLargeException) return IllegalStateException("page too large", err)
        val msg = if (err.message?.contains("timed out", ignoreCase = true) ==
            true
        ) {
            "Request timed out"
        } else {
            err.message
        }
        return IllegalStateException(msg ?: "fetch failed", err)
    }
}
