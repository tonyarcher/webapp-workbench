package rssapi.ai

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import java.util.Base64

data class HttpResult(val status: Int, val body: String)

class AiException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)

/** Minimal HTTP surface so tests fake the wire without mocking final JDK classes. */
interface HttpPoster {
    fun get(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult
    fun post(url: String, headers: Map<String, String>, body: String, timeoutMs: Long): HttpResult
    fun delete(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult
}

class JdkHttpPoster : HttpPoster {
    private val client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build()

    override fun get(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult {
        val res = wrapIo {
            val call = newRequest(url, headers, timeoutMs).GET().build()
            client.send(call, HttpResponse.BodyHandlers.ofString())
        }
        return HttpResult(res.statusCode(), res.body())
    }

    override fun post(url: String, headers: Map<String, String>, body: String, timeoutMs: Long): HttpResult {
        val res = wrapIo {
            val publisher = HttpRequest.BodyPublishers.ofString(body)
            val call = newRequest(url, headers, timeoutMs).POST(publisher).build()
            client.send(call, HttpResponse.BodyHandlers.ofString())
        }
        return HttpResult(res.statusCode(), res.body())
    }

    override fun delete(url: String, headers: Map<String, String>, timeoutMs: Long): HttpResult {
        val res = wrapIo {
            val publisher = HttpRequest.BodyPublishers.noBody()
            val call = newRequest(url, headers, timeoutMs).method("DELETE", publisher).build()
            client.send(call, HttpResponse.BodyHandlers.discarding())
        }
        return HttpResult(res.statusCode(), "")
    }

    private fun newRequest(url: String, headers: Map<String, String>, timeoutMs: Long): HttpRequest.Builder {
        try {
            val builder = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofMillis(timeoutMs))
            headers.forEach { (k, v) -> builder.header(k, v) }
            return builder
        } catch (err: IllegalArgumentException) {
            throw AiException("bad url", err)
        }
    }

    private inline fun <T> wrapIo(block: () -> T): T {
        return try {
            block()
        } catch (err: InterruptedException) {
            Thread.currentThread().interrupt()
            throw AiException("interrupted", err)
        } catch (err: java.io.IOException) {
            throw AiException("request failed", err)
        }
    }
}

interface AiBackend {
    fun probe(): Boolean
    fun summarize(system: String, text: String): String
}

val jsonMapper = ObjectMapper()

fun jsonBody(value: Any): String = jsonMapper.writeValueAsString(value)

fun parseJson(body: String): JsonNode = jsonMapper.readTree(body)

/** Parse a model-host body, mapping malformed payloads to AiException (502 downstream, never 500). */
fun parseBody(body: String, what: String): JsonNode = try {
    parseJson(body)
} catch (err: java.io.IOException) {
    throw AiException("$what returned bad json", err)
}

fun basicAuth(user: String, password: String): Map<String, String> {
    if (user.isEmpty()) return emptyMap()
    val token = Base64.getEncoder().encodeToString("$user:$password".toByteArray())
    return mapOf("Authorization" to "Basic $token")
}

fun requireOk(result: HttpResult, what: String): String {
    if (result.status in 200..299) return result.body
    throw AiException("$what failed with status ${result.status}")
}
