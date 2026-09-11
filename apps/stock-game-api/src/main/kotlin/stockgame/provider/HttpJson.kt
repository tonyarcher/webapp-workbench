package stockgame.provider

import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import stockgame.domain.ProviderError

private val CLIENT: HttpClient = HttpClient.newBuilder()
    .connectTimeout(Duration.ofSeconds(15))
    .build()

private val MAPPER = ObjectMapper()

fun fetchJson(url: String, userAgent: String): JsonNode {
    val req = HttpRequest.newBuilder(URI.create(url))
        .timeout(Duration.ofSeconds(20))
        .header("User-Agent", userAgent)
        .GET()
        .build()
    val resp = runCatching { CLIENT.send(req, HttpResponse.BodyHandlers.ofString()) }
        .getOrElse { throw ProviderError("Network error reaching price provider") }
    checkStatus(resp.statusCode())
    return MAPPER.readTree(resp.body())
}

private fun checkStatus(status: Int) {
    if (status == 429) throw ProviderError("Yahoo Finance rate limit hit (429). Try again in a minute.")
    if (status !in 200..299) throw ProviderError("Yahoo Finance request failed with status $status")
}
