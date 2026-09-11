package rssapi.domain

import java.net.URI

fun safeHttpUrl(url: String?): String? {
    if (url.isNullOrBlank()) return null
    return try {
        val u = URI(url.trim()).toURL()
        if (u.protocol == "http" || u.protocol == "https") u.toString() else null
    } catch (_: Exception) {
        null
    }
}

fun domainOf(url: String?): String {
    if (url.isNullOrBlank()) return ""
    return try {
        URI(url).host?.removePrefix("www.")?.lowercase() ?: ""
    } catch (_: Exception) {
        ""
    }
}

fun hostTitleFor(url: String): String = try {
    URI(url).host ?: url
} catch (_: Exception) {
    url
}

private val UUID_RE =
    Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", RegexOption.IGNORE_CASE)

fun isUuid(value: String?): Boolean = value != null && UUID_RE.matches(value)
