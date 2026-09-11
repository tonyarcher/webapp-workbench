package rssapi.domain

import org.jsoup.Jsoup
import org.jsoup.nodes.Element
import org.jsoup.safety.Safelist

private val SAFE = Safelist.none()
    .addTags(
        "p", "div", "span", "br", "hr", "a", "img", "ul", "ol", "li",
        "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "code",
        "em", "strong", "b", "i", "u", "s", "small", "table", "thead",
        "tbody", "tfoot", "tr", "td", "th", "caption", "figure", "figcaption",
    )
    .addAttributes("a", "href", "title")
    .addAttributes("img", "src", "srcset", "alt", "title", "width", "height")
    .addAttributes("td", "colspan", "rowspan")
    .addAttributes("th", "colspan", "rowspan")
    .addProtocols("a", "href", "http", "https")
    .addProtocols("img", "src", "http", "https")

fun stripHtml(html: String?): String {
    if (html.isNullOrEmpty()) return ""
    return try {
        Jsoup.parseBodyFragment(html).text().replace(Regex("\\s+"), " ").trim()
    } catch (_: Exception) {
        stripTags(html)
    }
}

fun sanitizeHtml(html: String?): String {
    if (html.isNullOrEmpty()) return ""
    return try {
        val cleaned = Jsoup.clean(html, SAFE)
        val doc = Jsoup.parseBodyFragment(cleaned)
        doc.select("img[srcset]").forEach { sanitizeSrcset(it) }
        doc.body().html()
    } catch (_: Exception) {
        stripHtml(html)
    }
}

private fun sanitizeSrcset(img: Element) {
    val value = img.attr("srcset")
    val out = mutableListOf<String>()
    for (candidate in value.split(",")) {
        val parts = candidate.trim().split(Regex("\\s+"))
        val url = parts.firstOrNull() ?: run {
            img.removeAttr("srcset")
            return
        }
        val safe = if (url.startsWith("//")) safeHttpUrl("https:$url") else safeHttpUrl(url)
        if (safe == null) {
            img.removeAttr("srcset")
            return
        }
        out.add((listOf(safe) + parts.drop(1)).joinToString(" "))
    }
    if (out.isEmpty()) img.removeAttr("srcset") else img.attr("srcset", out.joinToString(", "))
}
