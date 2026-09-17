package rssapi.domain

import org.w3c.dom.Document
import org.w3c.dom.Element

internal fun parseAtom(doc: Document, fallbackPublished: Long): ParsedFeed {
    val feedEl = doc.documentElement
    val title = feedEl.childText("title").ifEmpty { "Untitled feed" }
    val items = feedEl.descendants("entry").map { atomEntry(it, fallbackPublished, title) }
    return ParsedFeed(title, atomSiteUrl(feedEl), items)
}

private fun atomSiteUrl(feedEl: Element): String? {
    var siteUrl: String? = null
    for (link in feedEl.descendants("link")) {
        val href = safeHttpUrl(link.getAttribute("href")) ?: continue
        if (siteUrl == null || link.getAttribute("rel") == "alternate") siteUrl = href
    }
    return siteUrl
}

private fun atomEntry(entry: Element, fallbackPublished: Long, feedTitle: String): ParsedItem {
    val link = atomLink(entry)
    val published = atomPublished(entry, fallbackPublished)
    val summary = entry.childText("summary")
    val content = entry.childText("content")
    return ParsedItem(
        guid = entry.childText("id").ifEmpty { link }.orEmpty().ifEmpty { "$published-$feedTitle" },
        title = entry.childText("title").ifEmpty { "(untitled)" },
        published = published,
        link = link,
        author = entry.childText("name").ifEmpty { null },
        summary = stripHtml(summary).take(500).ifEmpty { null },
        content = content.ifEmpty { summary }.ifEmpty { null },
        media = parseAtomMedia(entry) ?: firstImageUrl(content.ifEmpty { summary }.ifEmpty { null }),
        comments = parseCommentCount(entry),
    )
}

private fun atomLink(entry: Element): String? {
    var link: String? = null
    for (l in entry.descendants("link")) {
        val href = safeHttpUrl(l.getAttribute("href")) ?: continue
        if (link == null || l.getAttribute("rel") == "alternate") link = href
    }
    return link
}

private fun atomPublished(entry: Element, fallbackPublished: Long): Long {
    val pub = tryParsePub(entry.childText("published").ifEmpty { null }, 0L)
    if (pub != 0L) return pub
    val upd = tryParsePub(entry.childText("updated").ifEmpty { null }, 0L)
    return if (upd != 0L) upd else fallbackPublished
}
