package rssapi.domain

import org.w3c.dom.Element

internal fun parseMedia(item: Element, link: String? = null): String? {
    enclosureMedia(item)?.let { return it }
    mediaFromName(item, "content")?.let { return it }
    thumbFrom(item)?.let { return it }
    itunesImage(item)?.let { return it }
    imageElement(item)?.let { return it }
    return linkImage(link)
}

private fun enclosureMedia(item: Element): String? {
    for (enc in item.descendants("enclosure")) {
        val url = enc.getAttribute("url")
        if (url.isNotEmpty() && isImageType(enc.getAttribute("type").ifEmpty { null })) {
            safeHttpUrl(url)?.let { return it }
        }
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
        if (url.isNotEmpty()) safeHttpUrl(url)?.let { return it }
    }
    return null
}

private fun itunesImage(item: Element): String? {
    // <itunes:image href="..."/> (common on podcast feeds)
    for (node in item.descendants("image")) {
        val href = node.getAttribute("href")
        if (href.isNotEmpty()) safeHttpUrl(href)?.let { return it }
        val url = node.getAttribute("url")
        if (url.isNotEmpty()) safeHttpUrl(url)?.let { return it }
    }
    return null
}

private fun imageElement(item: Element): String? {
    // Some feeds embed <image><url>...</url></image> inside an item.
    for (node in item.descendants("image")) {
        val url = node.childText("url").ifEmpty { node.textContent?.trim().orEmpty() }
        if (url.isNotEmpty()) safeHttpUrl(url)?.let { return it }
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

internal fun parseAtomMedia(entry: Element): String? =
    entry.descendants("link").firstNotNullOfOrNull { enclosureHref(it) }

private fun enclosureHref(link: Element): String? {
    if (link.getAttribute("rel") != "enclosure") return null
    if (!isImageType(link.getAttribute("type").ifEmpty { null })) return null
    return safeHttpUrl(link.getAttribute("href"))
}
