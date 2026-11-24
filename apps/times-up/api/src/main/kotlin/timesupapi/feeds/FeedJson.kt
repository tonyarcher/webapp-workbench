package timesupapi.feeds
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import timesupapi.platform.safeHttpUrl
import timesupapi.platform.stripHtml

private val jsonMapper = ObjectMapper()
private const val SUMMARY_CHARS = 500
private const val VERSION_1 = "https://jsonfeed.org/version/1"
private const val VERSION_1_1 = "https://jsonfeed.org/version/1.1"

private fun JsonNode.textOf(field: String): String? = path(field).text()

private fun JsonNode.text(): String? = takeIf { it.isTextual }?.asText()?.trim()?.takeIf { it.isNotEmpty() }

private fun JsonNode.array(): List<JsonNode> = takeIf { it.isArray }?.toList().orEmpty()

/**
 * JSON Feed 1.1 (and 1.0) normalizes into the same ParsedFeed as RSS/Atom.
 * Content stays untrusted: it is stored as fetched and sanitized at render,
 * exactly like the XML paths. Fields we do not model (authors' avatars,
 * attachment sizes, extension objects) are ignored safely.
 */
internal fun parseFeedJson(json: String, fallbackPublished: Long): ParsedFeed {
    val root = jsonMapper.readTree(json)
    require(root.isObject) { "Not a valid JSON Feed (expected an object)" }
    val version = root.textOf("version") ?: throw IllegalArgumentException("JSON Feed version is required")
    require(version == VERSION_1 || version == VERSION_1_1) { "Unsupported JSON Feed version: $version" }
    val title = root.textOf("title") ?: "Untitled feed"
    return ParsedFeed(
        title = title,
        siteUrl = safeHttpUrl(root.textOf("home_page_url") ?: root.textOf("feed_url")),
        icon = safeHttpUrl(root.textOf("icon") ?: root.textOf("favicon")),
        items = root.path("items").array().mapIndexed { index, item ->
            jsonItem(item, fallbackPublished, title, index)
        },
    )
}

private fun jsonItem(item: JsonNode, fallback: Long, feedTitle: String, index: Int): ParsedItem {
    val link = safeHttpUrl(item.textOf("url") ?: item.textOf("external_url"))
    val published = tryParsePub(item.textOf("date_published") ?: item.textOf("date_modified"), fallback)
    val html = item.textOf("content_html")
    val plain = item.textOf("content_text")
    return ParsedItem(
        guid = item.textOf("id") ?: link ?: "$published-$feedTitle-$index",
        title = item.textOf("title") ?: "(untitled)",
        published = published,
        link = link,
        author = item.path("author").textOf("name"),
        summary = jsonSummary(item, plain, html),
        content = html ?: plain,
        media = jsonMedia(item, html ?: plain, link),
    )
}

private fun jsonSummary(item: JsonNode, plain: String?, html: String?): String? {
    val tags = item.path("tags").array().mapNotNull { it.text() }
    val text = stripHtml(item.textOf("summary") ?: plain ?: html)
    return listOfNotNull(
        text.take(SUMMARY_CHARS).ifEmpty { null },
        tags.joinToString(" ") { "#$it" }.ifEmpty { null },
    ).joinToString(" ").ifEmpty { null }
}

private fun jsonMedia(item: JsonNode, content: String?, link: String?): String? =
    item.path("attachments").array().firstNotNullOfOrNull { attachment ->
        val type = attachment.textOf("content_type").orEmpty()
        val isMedia = type.startsWith("image/") || type.startsWith("audio/") || type.startsWith("video/")
        if (isMedia) attachment.textOf("url")?.let { safeHttpUrl(it) } else null
    } ?: firstImageUrl(content, link)
