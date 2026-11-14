package rssapi.domain

import org.jsoup.nodes.Document
import org.jsoup.nodes.Element

private const val MIN_PARAGRAPH = 40
private const val BIG_TEXT_KEEP = 800

private const val HINT_POSITIVE = 25.0
private const val HINT_NEGATIVE = 25.0
private const val TAG_ARTICLE = 15.0
private const val TAG_MAIN = 10.0
private const val COMMA_WEIGHT = 1.5
private const val TEXT_LEN_DIV = 20.0
private const val TEXT_LEN_CAP = 40.0
private const val PARA_WEIGHT = 3.0
private const val PARA_CAP = 30.0
private const val DENSITY_BASE = 0.3
private const val DENSITY_SCALE = 0.7

private val UNLIKELY =
    Regex(
        "banner|breadcrumb|combx|comment|community|cover-wrap|disqus|extra|foot|header|" +
            "legends|menu|modal|related|remark|replies|rss|shoutbox|sidebar|skyscraper|" +
            "social|sponsor|supplemental|ad-break|agegate|pagination|pager|popup|yom-remote",
        RegexOption.IGNORE_CASE,
    )

private val MAYBE_CONTENT = Regex("and|article|body|column|content|main|shadow|story", RegexOption.IGNORE_CASE)

private val POSITIVE =
    Regex(
        "article|body|content|entry|hentry|h-entry|main|page|pagination|post|text|blog|story",
        RegexOption.IGNORE_CASE,
    )

private val NEGATIVE =
    Regex(
        "hidden|^hid$|hid$|hid |^hid |banner|combx|comment|com-|contact|footer|gdpr|" +
            "masthead|media|meta|outbrain|promo|related|scroll|share|shoutbox|sidebar|" +
            "sponsor|shopping|tags|tool|widget|subscribe|newsletter|nav",
        RegexOption.IGNORE_CASE,
    )

internal fun stripNoise(doc: Document) {
    doc.select(
        "script, style, noscript, iframe, svg, canvas, form, nav, footer, header, aside, " +
            "[role=navigation], [role=banner], [role=complementary], [role=contentinfo], " +
            ".ad, .ads, .advert, .advertisement, .social, .share, .comments, .comment, " +
            ".related, .sidebar, .promo, .newsletter, .subscribe",
    ).remove()
    pruneUnlikely(doc)
}

private fun pruneUnlikely(doc: Document) {
    for (el in doc.body().select("*")) {
        val hint = (el.id() + " " + el.className()).trim()
        if (hint.isEmpty()) continue
        if (isUnlikelyNoise(hint) && el.text().length < BIG_TEXT_KEEP) el.remove()
    }
}

internal fun isUnlikelyNoise(hint: String): Boolean =
    UNLIKELY.containsMatchIn(hint) && !MAYBE_CONTENT.containsMatchIn(hint)

internal fun articleScore(el: Element): Double {
    val full = el.text()
    if (full.length < MIN_PARAGRAPH) return 0.0
    var s = hintScore(el)
    s += textScore(el)
    return s * linkDensityFactor(el, full)
}

private fun hintScore(el: Element): Double {
    var s = 0.0
    val hint = el.id() + " " + el.className()
    if (POSITIVE.containsMatchIn(hint)) s += HINT_POSITIVE
    if (NEGATIVE.containsMatchIn(hint)) s -= HINT_NEGATIVE
    if (el.tagName() == "article") s += TAG_ARTICLE
    if (el.tagName() == "main") s += TAG_MAIN
    return s
}

private fun textScore(el: Element): Double {
    val paragraphs = el.select("p")
    val pText = paragraphs.joinToString(" ") { it.text() }
    val commas = pText.count { it == ',' } + pText.count { it == '，' }
    val paraCount = paragraphs.count { it.text().length > MIN_PARAGRAPH }
    return commas * COMMA_WEIGHT +
        minOf(pText.length / TEXT_LEN_DIV, TEXT_LEN_CAP) +
        minOf(paraCount * PARA_WEIGHT, PARA_CAP)
}

private fun linkDensityFactor(el: Element, full: String): Double {
    if (full.isEmpty()) return 1.0
    val linkText = el.select("a").sumOf { it.text().length }
    val density = 1.0 - (linkText.toDouble() / full.length.toDouble())
    return DENSITY_BASE + DENSITY_SCALE * density.coerceIn(0.0, 1.0)
}
