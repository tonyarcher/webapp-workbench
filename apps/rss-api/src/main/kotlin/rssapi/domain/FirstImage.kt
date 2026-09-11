package rssapi.domain

fun firstImageUrl(html: String?): String? {
    if (html.isNullOrEmpty()) return null
    val lazy = Regex(
        """<img[^>]+(?:data-src|data-lazy-src|data-original)=["']([^"']+)["']""",
        RegexOption.IGNORE_CASE,
    ).find(html)
    if (lazy != null) return safeHttpUrl(lazy.groupValues[1])
    val src = Regex("""<img[^>]+src=["']([^"']+)["']""", RegexOption.IGNORE_CASE).find(html)
    if (src != null) return safeHttpUrl(src.groupValues[1])
    val srcset = Regex("""<img[^>]+srcset=["']([^"']+)["']""", RegexOption.IGNORE_CASE).find(html)
    if (srcset != null) {
        val first = srcset.groupValues[1].split(",")[0].trim().split(" ")[0]
        if (first.isNotEmpty()) return safeHttpUrl(first)
    }
    return null
}
