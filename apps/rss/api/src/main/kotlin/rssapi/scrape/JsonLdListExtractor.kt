package rssapi.scrape

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.jsoup.nodes.Document
import org.springframework.stereotype.Component
import rssapi.domain.safeHttpUrl
import rssapi.domain.tryParsePub
import java.net.URI

private const val MAX_DEPTH = 6
private const val MAX_SUMMARY = 300
private const val LIST_CONFIDENCE = 0.8f

/** Pages that advertise their article list as JSON-LD (ItemList or articles). */
@Component
class JsonLdListExtractor : PageExtractor {
    override val id = "json-ld-list"
    override val label = "Structured article list"

    private val mapper = ObjectMapper()

    override fun confidence(doc: Document): Float = when {
        doc.select("script[type=application/ld+json]").any { script ->
            val data = script.data()
            data.contains("ItemList", ignoreCase = true) || data.contains("headline", ignoreCase = true)
        } -> LIST_CONFIDENCE

        else -> 0f
    }

    override fun extract(doc: Document, baseUrl: String): List<ScrapeCandidate> {
        val found = mutableListOf<ScrapeCandidate>()
        for (script in doc.select("script[type=application/ld+json]")) {
            runCatching { mapper.readTree(script.data()) }.getOrNull()?.let { collect(it, found, baseUrl, 0) }
        }
        return found.distinctBy { it.url }
    }

    private fun collect(node: JsonNode, found: MutableList<ScrapeCandidate>, baseUrl: String, depth: Int) {
        if (depth > MAX_DEPTH) return
        when {
            node.isArray -> node.forEach { collect(it, found, baseUrl, depth + 1) }
            node.isObject -> objectNode(node, found, baseUrl, depth)
        }
    }

    private fun objectNode(node: JsonNode, found: MutableList<ScrapeCandidate>, baseUrl: String, depth: Int) {
        candidate(node, baseUrl)?.let(found::add)
        val types = "${node.path("@type").asText("")} ${node.path("type").asText("")}"
        if (types.contains("ItemList", ignoreCase = true)) {
            node.path("itemListElement").forEach { element ->
                val item = element.path("item")
                collect(if (item.isMissingNode || item.isNull) element else item, found, baseUrl, depth + 1)
            }
        }
        for (field in listOf("@graph", "mainEntity")) {
            val child = node.path(field)
            if (!child.isMissingNode && !child.isNull) collect(child, found, baseUrl, depth + 1)
        }
    }

    private fun candidate(node: JsonNode, baseUrl: String): ScrapeCandidate? {
        val title = text(node, "headline") ?: text(node, "name") ?: return null
        val href = text(node, "url") ?: return null
        val url = runCatching { safeHttpUrl(URI(baseUrl).resolve(href).toString()) }.getOrNull() ?: return null
        val published = listOfNotNull(text(node, "datePublished"), text(node, "dateModified"))
            .firstNotNullOfOrNull { tryParsePub(it, 0L).takeIf { value -> value > 0 } }
        val summary = text(node, "description")?.take(MAX_SUMMARY)?.ifEmpty { null }
        return ScrapeCandidate(title, url, published, summary)
    }

    private fun text(node: JsonNode, field: String): String? = node.path(field).takeIf { it.isTextual }
        ?.asText()?.trim()?.takeIf { it.isNotEmpty() }
}
