package timesupapi.fetch

import timesupapi.platform.FETCH_TIMEOUT_MS
import timesupapi.platform.MAX_FEED_BYTES
import java.io.IOException
import java.net.URI

/** Redirect chasing is bounded; 304/200 are HTTP semantics, not tunables. */
private const val MAX_FETCH_HOPS = 6
private const val MAX_REDIRECTS = 5
private const val NOT_MODIFIED = 304
private const val HTTP_OK = 200

class HttpFeedFetcher(private val allowLocal: Boolean) : FeedFetcher {
    private val resolver = PublicDnsResolver(allowLocal)

    override fun fetch(url: String, etag: String?, lastModified: String?): FetchResult {
        var current = url
        repeat(MAX_FETCH_HOPS) { hop ->
            val headers = buildMap {
                put("User-Agent", "times-up-server/0.1")
                put(
                    "Accept",
                    "application/rss+xml, application/atom+xml, application/feed+json, application/json, " +
                        "application/xml, text/xml, */*",
                )
                etag?.let { put("If-None-Match", it) }
                lastModified?.let { put("If-Modified-Since", it) }
            }
            val resp = send(current, headers)
            val loc = resp.headers["location"]?.firstOrNull()
            if (resp.status in 300..399 && loc != null) {
                if (hop >= MAX_REDIRECTS) throw IllegalStateException("Too many redirects")
                current = URI(current).resolve(loc).toString()
                return@repeat
            }
            return toResult(resp)
        }
        throw IllegalStateException("Too many redirects")
    }

    private fun send(url: String, headers: Map<String, String>): PinnedResponse = try {
        sendPinned(url, resolver, FETCH_TIMEOUT_MS, headers, MAX_FEED_BYTES)
    } catch (err: IllegalArgumentException) {
        throw err
    } catch (err: IOException) {
        throw wrapFetch(err)
    }

    private fun toResult(resp: PinnedResponse): FetchResult {
        val etag = resp.headers["etag"]?.firstOrNull()
        val lastMod = resp.headers["last-modified"]?.firstOrNull()
        if (resp.status == NOT_MODIFIED) return FetchResult(NOT_MODIFIED, etag = etag, lastModified = lastMod)
        if (resp.status !in 200..299) throw IllegalStateException("HTTP ${resp.status}")
        return FetchResult(HTTP_OK, String(resp.body, Charsets.UTF_8), etag, lastMod)
    }

    private fun wrapFetch(err: IOException): IllegalStateException {
        if (err is BodyTooLargeException) return IllegalStateException("feed too large", err)
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
