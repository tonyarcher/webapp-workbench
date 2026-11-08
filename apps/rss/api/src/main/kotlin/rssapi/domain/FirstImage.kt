package rssapi.domain

import java.net.URI

private const val X_DESCRIPTOR_SCALE = 1000

fun firstImageUrl(html: String?, base: String? = null): String? {
    if (html.isNullOrEmpty()) return null
    val patterns = listOf(
        Regex(
            """<img[^>]+(?:data-srcset|data-original-src|data-lazy-src|data-original|data-src|data-url|data-image|data-thumb)=["']([^"']+)["']""",
            RegexOption.IGNORE_CASE,
        ),
        Regex("""<img[^>]+src=["']([^"']+)["']""", RegexOption.IGNORE_CASE),
        Regex("""<img[^>]+srcset=["']([^"']+)["']""", RegexOption.IGNORE_CASE),
        Regex("""<source[^>]+srcset=["']([^"']+)["']""", RegexOption.IGNORE_CASE),
        Regex("""<video[^>]+poster=["']([^"']+)["']""", RegexOption.IGNORE_CASE),
    )
    for (re in patterns) {
        val result = tryPattern(re, html, base)
        if (result != null) return result
    }
    return null
}

private fun tryPattern(re: Regex, html: String, base: String?): String? {
    val m = re.find(html) ?: return null
    val raw = m.groupValues[1].trim()
    if (raw.isEmpty()) return null
    val candidate = if (re.pattern.contains("srcset")) pickSrcset(raw) else raw
    if (candidate.isNullOrEmpty()) return null
    val resolved = resolveUrl(candidate, base) ?: return null
    return safeHttpUrl(resolved)
}

private fun pickSrcset(raw: String): String? {
    val candidates = raw.split(",").mapNotNull { part ->
        val tokens = part.trim().split(Regex("\\s+"))
        val url = tokens.firstOrNull()?.takeIf { it.isNotEmpty() } ?: return@mapNotNull null
        val desc = tokens.getOrNull(1).orEmpty()
        val score = descriptorScore(desc)
        Pair(url, score)
    }
    if (candidates.isEmpty()) return null
    val best = candidates.maxByOrNull { it.second }
    return best?.first ?: candidates.first().first
}

private fun descriptorScore(desc: String): Int {
    val w = Regex("""^(\d+)w$""", RegexOption.IGNORE_CASE).find(desc)?.groupValues?.get(1)?.toIntOrNull()
    if (w != null) return w
    val x = Regex("""^(\d+(?:\.\d+)?)x$""", RegexOption.IGNORE_CASE).find(desc)?.groupValues?.get(1)?.toDoubleOrNull()
    if (x != null) return (x * X_DESCRIPTOR_SCALE).toInt()
    return 0
}

private fun resolveUrl(url: String, base: String?): String? {
    val trimmed = url.trim()
    if (trimmed.isEmpty()) return null
    if (trimmed.startsWith("//")) return "https:$trimmed"
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed
    if (base.isNullOrBlank()) return null
    return try {
        URI(base).resolve(trimmed).toString()
    } catch (_: Exception) {
        null
    }
}
