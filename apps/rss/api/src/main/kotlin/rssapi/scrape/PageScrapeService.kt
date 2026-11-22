package rssapi.scrape
import org.jsoup.nodes.Document
import org.springframework.http.HttpStatus
import org.springframework.http.HttpStatusCode
import org.springframework.stereotype.Service
import rssapi.fetch.PageFetcher
import rssapi.platform.ApiException
private const val MAX_CANDIDATES = 50
private val NO_LIST_STATUS: HttpStatusCode = HttpStatusCode.valueOf(422)

/** Everything the browser needs to draw a page preview and its highlight boxes. */
data class ScrapePreviewResult(
    val html: String,
    val baseUrl: String,
    val title: String?,
    val strategies: List<ScrapeStrategy>,
)

/** Fetches a page once and shows every way its article list can be read. */
@Service
class PageScrapeService(private val pages: PageFetcher, private val extractors: List<PageExtractor>) {
    fun preview(url: String?, selector: String?): ScrapePreviewResult {
        val target = ScrapeFetch.target(url)
        val doc = ScrapeFetch.doc(pages, target)
        val strategies = strategies(doc, target, selector)
        return ScrapePreviewResult(
            html = previewHtml(doc),
            baseUrl = target,
            title = doc.title().ifBlank { null },
            strategies = strategies,
        )
    }

    private fun strategies(doc: Document, url: String, selector: String?): List<ScrapeStrategy> {
        val found = extractors.mapNotNull { strategy(it, doc, url, "strategy:${it.id}") }.toMutableList()
        if (!selector.isNullOrBlank()) {
            strategy(SelectorListExtractor(selector), doc, url, selector)?.let(found::add)
        }
        if (found.isEmpty()) throw ApiException(NO_LIST_STATUS, "No article list found on this page")
        return found.sortedByDescending { it.confidence }
    }

    private fun strategy(extractor: PageExtractor, doc: Document, url: String, stored: String): ScrapeStrategy? {
        val confidence = extractor.confidence(doc)
        if (confidence <= 0f) return null
        val found = runCatching { extractor.extract(doc, url) }
            .getOrElse { throw ApiException(HttpStatus.BAD_REQUEST, "Could not read this page's list", it) }
            .distinctBy { it.url }
            .take(MAX_CANDIDATES)
        if (found.isEmpty() && !stored.startsWith("strategy:")) {
            return ScrapeStrategy(extractor.id, extractor.label, confidence, stored, found)
        }
        if (found.isEmpty()) return null
        return ScrapeStrategy(extractor.id, extractor.label, confidence, stored, found)
    }

    /** Scripts and frames cannot run in the preview; keep layout styles intact. */
    private fun previewHtml(doc: Document): String {
        val copy = doc.clone()
        copy.select("script, iframe, object, embed, form, noscript").remove()
        copy.select("*").removeAttr("onclick onload onerror onmouseover")
        return copy.outerHtml()
    }
}
