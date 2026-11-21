package rssapi.scrape

import org.jsoup.nodes.Document
import rssapi.domain.ParsedItem

/** Shared extraction rules for the preview endpoint and the ingest path. */
object ScrapeExtraction {
    fun best(doc: Document, selector: String?): PageExtractor {
        if (!selector.isNullOrBlank()) return SelectorListExtractor(selector)
        return listOf(JsonLdListExtractor(), SemanticListExtractor())
            .maxByOrNull { it.confidence(doc) }
            ?.takeIf { it.confidence(doc) > 0f }
            ?: throw IllegalArgumentException("No article list found on this page")
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
