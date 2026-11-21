package rssapi.scrape

import org.jsoup.nodes.Document
import rssapi.domain.ParsedItem

/** Shared extraction rules for the preview endpoint and the ingest path. */
object ScrapeExtraction {
    fun all(doc: Document): List<PageExtractor> = listOf(
        JsonLdListExtractor(),
        SemanticListExtractor(),
    ).filter { it.confidence(doc) > 0f }

    fun byId(doc: Document, id: String): PageExtractor? = all(doc).firstOrNull { it.id == id }

    fun best(doc: Document, selector: String?): PageExtractor {
        if (selector.isNullOrBlank()) {
            return all(doc).maxByOrNull { it.confidence(doc) }
                ?: throw IllegalArgumentException("No article list found on this page")
        }
        if (selector.startsWith("strategy:")) {
            return byId(doc, selector.removePrefix("strategy:"))
                ?: throw IllegalArgumentException("Unknown article list strategy: $selector")
        }
        return SelectorListExtractor(selector)
    }

    fun items(candidates: List<ScrapeCandidate>, now: Long): List<ParsedItem> = candidates.map { candidate ->
        ParsedItem(
            guid = candidate.url,
            title = candidate.title,
            published = candidate.published ?: now,
            link = candidate.url,
            summary = candidate.summary,
            content = candidate.summary?.let { "<p>$it</p>" },
        )
    }
}
