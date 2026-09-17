package rssapi.domain

import org.w3c.dom.Element

internal fun parseCommentCount(item: Element): Int? {
    val node = item.firstDesc("comments")
        ?: item.firstDesc("total")
        ?: item.firstDesc("comment_count")
        ?: item.firstDesc("comment-count")
    val candidate = node?.textContent?.trim() ?: return null
    val n = candidate.toDoubleOrNull() ?: return null
    return if (n >= 0) n.toInt() else null
}

internal fun parseMedia(item: Element): String? {
    enclosureMedia(item)?.let { return it }
    mediaFromName(item, "content")?.let { return it }
    return thumbFrom(item)
}

internal fun parseAtomMedia(entry: Element): String? =
    entry.descendants("link").firstNotNullOfOrNull { enclosureHref(it) }

private fun enclosureHref(link: Element): String? {
    if (link.getAttribute("rel") != "enclosure") return null
    if (!isImageType(link.getAttribute("type").ifEmpty { null })) return null
    return safeHttpUrl(link.getAttribute("href"))
}

private fun enclosureMedia(item: Element): String? {
    val enc = item.descendants("enclosure").firstOrNull() ?: return null
    val url = enc.getAttribute("url")
    if (url.isNotEmpty() && isImageType(enc.getAttribute("type").ifEmpty { null })) {
        return safeHttpUrl(url)
    }
    return null
}

private fun mediaFromName(item: Element, local: String): String? {
    for (node in item.descendants(local)) {
        mediaContentUrl(node)?.let { return it }
    }
    return null
}

private fun thumbFrom(item: Element): String? {
    for (node in item.descendants("thumbnail")) {
        val url = node.getAttribute("url")
        if (url.isNotEmpty()) return safeHttpUrl(url)
    }
    return null
}

private fun mediaContentUrl(node: Element): String? {
    val url = node.getAttribute("url")
    if (url.isEmpty()) return null
    val medium = node.getAttribute("medium")
    val type = node.getAttribute("type").ifEmpty { null }
    if (medium == "image" || isImageType(type)) return safeHttpUrl(url)
    return null
}

private fun isImageType(type: String?): Boolean = type == null || type.startsWith("image/")
