package calsync.trakt

import calsync.web.ApiException
import org.springframework.http.HttpStatus
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

const val TRAKT_BASE = "https://api.trakt.tv"

/** Trakt answers 429 without a Retry-After; the caller maps it, never retries blind. */
internal const val HTTP_TOO_MANY_REQUESTS = 429

private const val CONNECT_TIMEOUT_SECONDS = 10L
private const val READ_TIMEOUT_SECONDS = 30L

data class TraktReply(val status: Int, val body: String)

class TraktTransportException(message: String) : RuntimeException(message)

interface TraktHttp {
    fun get(path: String, headers: Map<String, String>): TraktReply
    fun post(path: String, headers: Map<String, String>, body: String): TraktReply
}

internal fun traktHeaders(clientId: String, token: String?): Map<String, String> {
    val headers = mutableMapOf(
        "Content-Type" to "application/json",
        "trakt-api-version" to "2",
        "trakt-api-key" to clientId,
    )
    if (!token.isNullOrBlank()) headers["Authorization"] = "Bearer $token"
    return headers
}

internal fun checkedBody(reply: TraktReply): String {
    if (reply.status == HTTP_TOO_MANY_REQUESTS) throw ApiException(HttpStatus.TOO_MANY_REQUESTS, "trakt rate limited")
    if (reply.status !in 200..299) throw ApiException(HttpStatus.BAD_GATEWAY, "trakt request failed")
    return reply.body
}

/**
 * Trakt over JDK HTTP. Transport failures surface as [TraktTransportException];
 * HTTP statuses pass through untouched so the caller maps them. The base URL
 * is fixed: user input never reaches a host, only allowlisted paths.
 */
class JdkTraktHttp(
    private val base: String = TRAKT_BASE,
    private val connectTimeout: Duration = Duration.ofSeconds(CONNECT_TIMEOUT_SECONDS),
    private val readTimeout: Duration = Duration.ofSeconds(READ_TIMEOUT_SECONDS),
) : TraktHttp {
    private val client: HttpClient by lazy {
        HttpClient.newBuilder().connectTimeout(connectTimeout).build()
    }

    override fun get(path: String, headers: Map<String, String>): TraktReply = call("GET", path, headers, null)

    override fun post(path: String, headers: Map<String, String>, body: String): TraktReply =
        call("POST", path, headers, body)

    private fun call(method: String, path: String, headers: Map<String, String>, body: String?): TraktReply {
        try {
            val builder = HttpRequest.newBuilder()
                .uri(URI.create(base + path))
                .timeout(readTimeout)
            headers.forEach { (name, value) -> builder.header(name, value) }
            val publisher =
                if (body == null) HttpRequest.BodyPublishers.noBody() else HttpRequest.BodyPublishers.ofString(body)
            builder.method(method, publisher)
            val response = client.send(builder.build(), HttpResponse.BodyHandlers.ofString())
            return TraktReply(response.statusCode(), response.body())
        } catch (_: java.io.IOException) {
            transportFailed()
        } catch (_: InterruptedException) {
            Thread.currentThread().interrupt()
            transportFailed()
        } catch (_: IllegalArgumentException) {
            transportFailed()
        }
    }

    private fun transportFailed(): Nothing = throw TraktTransportException("trakt request failed")
}
