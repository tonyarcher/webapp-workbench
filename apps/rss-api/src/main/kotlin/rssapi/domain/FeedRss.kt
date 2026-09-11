package rssapi.domain

import org.w3c.dom.Document
import org.w3c.dom.Element

internal fun parseRss(doc: Document, fallbackPublished: Long): ParsedFeed {
    val channel = doc.documentElement.descendants("channel").firstOrNull() ?: doc.documentElement
    val title = channel.childText("title").ifEmpty { "Untitled feed" }
    val siteUrl = channel.childText("link").ifEmpty { null }
    val items = doc.documentElement.descendants("item").map { rssItem(it, fallbackPublished, title) }
    return ParsedFeed(title, siteUrl, items)
}

private fun rssItem(item: Element, fallbackPublished: Long, feedTitle: String): ParsedItem {
    val dcDate = item.firstDesc("date")?.textContent?.trim()
    val published = tryParsePub(item.childText("pubDate").ifEmpty { dcDate }, fallbackPublished)
    val description = item.childText("description")
    val encoded = item.firstDesc("encoded")?.textContent?.trim().orEmpty()
    val content = encoded.ifEmpty { description }.ifEmpty { null }
    val guid = item.childText("guid").ifEmpty { item.childText("link") }.ifEmpty { "$published-$feedTitle" }
    return ParsedItem(
        guid = guid,
        title = item.childText("title").ifEmpty { "(untitled)" },
        published = published,
        link = safeHttpUrl(item.childText("link").ifEmpty { null }),
        author = rssAuthor(item),
        summary = stripHtml(description).take(500).ifEmpty { null },
        content = content,
        media = parseMedia(item) ?: firstImageUrl(content),
        comments = parseCommentCount(item),
    )
}

private fun rssAuthor(item: Element): String? {
    val dc = item.firstDesc("creator")?.textContent?.trim()
    return item.childText("author").ifEmpty { dc.orEmpty() }.ifEmpty { null }
}

internal fun tryParsePub(value: String?, fallback: Long): Long {
    if (value.isNullOrBlank()) return fallback
    return try {
        java.time.Instant.parse(value).toEpochMilli()
    } catch (_: Exception) {
        try {
            java.time.ZonedDateTime.parse(value, java.time.format.DateTimeFormatter.RFC_1123_DATE_TIME)
                .toInstant().toEpochMilli()
        } catch (_: Exception) {
            fallback
        }
    }
}
