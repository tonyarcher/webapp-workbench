package rssapi.domain

import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import org.jsoup.nodes.Element
import java.net.URI

private const val MIN_TEXT_CHARS = 280
private const val MIN_SCORE = 20.0

/**
 * Best-effort main-article HTML extracted from a fetched page. Tries AMP/JSON-LD
 * hints first, then a readability-style text-density score. Result is an
 * unsanitized fragment; callers must pass it through [sanitizeHtml].
 */
fun extractArticleHtml(pageHtml: String, baseUrl: String): String? {
    if (pageHtml.isBlank()) return null
    val doc = Jsoup.parse(pageHtml, baseUrl)
    jsonLdArticleBody(doc)?.let { return it }
    stripNoise(doc)
    val best = pickBest(doc) ?: return null
    absolutize(best, baseUrl)
    return usableHtml(best)
}

private fun usableHtml(best: Element): String? {
    val html = best.html().trim()
    val text = best.text().trim()
    return if (text.length >= MIN_TEXT_CHARS && html.isNotBlank()) html else null
}

/** AMP alternate URL advertised by the page, resolved against [baseUrl]. */
fun ampUrlOf(pageHtml: String, baseUrl: String): String? {
    if (pageHtml.isBlank()) return null
    val doc = Jsoup.parse(pageHtml, baseUrl)
    return doc.selectFirst("link[rel=amphtml][href]")?.absUrl("href")?.ifBlank { null }
}

/** Canonical URL advertised by the page, resolved against [baseUrl]. */
fun canonicalUrlOf(pageHtml: String, baseUrl: String): String? {
    if (pageHtml.isBlank()) return null
    val doc = Jsoup.parse(pageHtml, baseUrl)
    return doc.selectFirst("link[rel=canonical][href]")?.absUrl("href")?.ifBlank { null }
}

private fun pickBest(doc: Document): Element? {
    val best = bestCandidate(doc)
    if (best == null || best.second < MIN_SCORE) return fallbackBody(doc)
    return best.first
}

private fun bestCandidate(doc: Document): Pair<Element, Double>? {
    val seen = HashSet<Element>()
    var best: Pair<Element, Double>? = null
    for (el in candidateElements(doc)) {
        if (!seen.add(el)) continue
        val s = articleScore(el)
        if (best == null || s > best.second) best = el to s
    }
    return best
}

private fun candidateElements(doc: Document): List<Element> {
    val out = ArrayList<Element>()
    out.addAll(doc.select("article, main, [itemprop=articleBody], [role=main]"))
    out.addAll(doc.select("div, section"))
    return out
}

private fun fallbackBody(doc: Document): Element? {
    val body = doc.body()
    return if (body.text().length >= MIN_TEXT_CHARS) body else null
}

private fun absolutize(root: Element, baseUrl: String) {
    root.select("[href]").forEach { el -> setAbs(el, "href") }
    root.select("[src]").forEach { el -> setAbs(el, "src") }
    runCatching { URI(baseUrl) }
}

private fun setAbs(el: Element, attr: String) {
    val abs = el.absUrl(attr)
    if (abs.isNotBlank()) el.attr(attr, abs)
}
