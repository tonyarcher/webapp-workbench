package rssapi.scrape

import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import org.springframework.http.HttpStatus
import org.springframework.http.HttpStatusCode
import org.springframework.stereotype.Service
import rssapi.domain.safeHttpUrl
import rssapi.fetch.PageFetcher
import rssapi.web.ApiException

private const val MAX_CANDIDATES = 50
private val NO_LIST_STATUS: HttpStatusCode = HttpStatusCode.valueOf(422)

/** Fetches a page once and lets the extractors compete for its article list. */
@Service
class PageScrapeService(private val pages: PageFetcher, private val extractors: List<PageExtractor>) {
    fun preview(url: String?, selector: String?): ScrapeResult {
        val target = target(url)
        val doc = Jsoup.parse(fetch(target), target)
        val chosen = choose(doc, selector)
        val candidates = candidates(chosen, doc, target)
        return ScrapeResult(chosen.id, chosen.label, chosen.confidence(doc), doc.title().ifBlank { null }, candidates)
    }

    private fun target(url: String?): String = safeHttpUrl(url)
        ?: throw ApiException(HttpStatus.BAD_REQUEST, "Invalid page URL (must be http/https)")

    private fun fetch(url: String): String = try {
        pages.fetchHtml(url)
    } catch (err: IllegalStateException) {
        throw ApiException(HttpStatus.BAD_REQUEST, "Could not fetch page: ${err.message ?: "error"}", err)
    }

    private fun choose(doc: Document, selector: String?): PageExtractor {
        if (!selector.isNullOrBlank()) return SelectorListExtractor(selector)
        return extractors.maxByOrNull { it.confidence(doc) }?.takeIf { it.confidence(doc) > 0f }
            ?: throw ApiException(NO_LIST_STATUS, "No article list found on this page")
    }

    private fun candidates(extractor: PageExtractor, doc: Document, url: String): List<ScrapeCandidate> {
        val found = runCatching { extractor.extract(doc, url) }
            .getOrElse { throw ApiException(HttpStatus.BAD_REQUEST, "Could not read this page's list", it) }
            .distinctBy { it.url }
            .take(MAX_CANDIDATES)
        if (found.isEmpty()) {
            throw ApiException(NO_LIST_STATUS, "${extractor.label} found no articles")
        }
        return found
    }
}
