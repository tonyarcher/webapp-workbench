package timesupapi.scrape
import org.jsoup.nodes.Element
import timesupapi.feeds.tryParsePub
import timesupapi.platform.safeHttpUrl

private const val MAX_TITLE = 200
private const val MAX_SUMMARY = 300

/** Short CSS path used to draw a preview box and to find the row again. */
internal fun cssPath(element: Element): String {
    if (element.id().isNotBlank()) return "#${cssEscape(element.id())}"
    val segments = mutableListOf<String>()
    var node: Element? = element
    while (node != null && node.tagName() != "body") {
        val tag = node.tagName()
        val classes = node.classNames().take(2).joinToString("") { ".${cssEscape(it)}" }
        val position = node.elementSiblingIndex() + 1
        segments.add(0, "$tag$classes:nth-child($position)")
        node = node.parent()
    }
    return segments.joinToString(" > ").ifEmpty { element.tagName() }
}

internal fun cssEscape(value: String): String = value.replace(Regex("[^a-zA-Z0-9_-]")) {
    "\\" + it.value
}

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
    return ScrapeCandidate(title, url, published, summary, cssPath(element))
}
