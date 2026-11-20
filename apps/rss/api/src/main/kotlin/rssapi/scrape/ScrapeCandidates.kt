package rssapi.scrape

import org.jsoup.nodes.Element
import rssapi.domain.safeHttpUrl
import rssapi.domain.tryParsePub

private const val MAX_TITLE = 200
private const val MAX_SUMMARY = 300

/** Shared shape-to-candidate mapping for element-based extractors. */
internal fun candidateFrom(element: Element): ScrapeCandidate? {
    val link = if (element.tagName() == "a" && element.hasAttr("href")) {
        element
    } else {
        element.selectFirst("h1 a, h2 a, h3 a, h4 a, a[href]") ?: return null
    }
    val href = link.absUrl("href").ifBlank { link.attr("href") }
    val url = safeHttpUrl(href) ?: return null
    val title = link.text().trim().ifEmpty { element.text().trim().take(MAX_TITLE) }.ifEmpty { null } ?: return null
    val published = element.selectFirst("time[datetime]")?.let { time ->
        val value = time.attr("datetime").ifBlank { time.text() }
        tryParsePub(value, 0L).takeIf { it > 0 }
    }
    val summary = element.selectFirst("p")?.text()?.trim()?.take(MAX_SUMMARY)?.ifEmpty { null }
    return ScrapeCandidate(title, url, published, summary)
}
