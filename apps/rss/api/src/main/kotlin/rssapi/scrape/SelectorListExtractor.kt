package rssapi.scrape
import org.jsoup.nodes.Document

/** Feedly-style escape hatch: the reader points at the list container. */
class SelectorListExtractor(private val selector: String) : PageExtractor {
    override val id = "selector"
    override val label = "Selected list: $selector"

    override fun confidence(doc: Document): Float = 1f

    override fun extract(doc: Document, baseUrl: String): List<ScrapeCandidate> = doc
        .select(selector.trim())
        .mapNotNull(::candidateFrom)
        .distinctBy { it.url }
}
