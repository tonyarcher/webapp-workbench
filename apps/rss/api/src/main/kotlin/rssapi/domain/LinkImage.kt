package rssapi.domain

fun linkImage(url: String?): String? {
    if (url.isNullOrBlank()) return null
    val safe = safeHttpUrl(url) ?: return null
    val yt = Regex(
        """(?:youtube\.com/(?:watch\?[^#]*v=|embed/|shorts/|live/)|youtu\.be/)([A-Za-z0-9_-]{6,})""",
        RegexOption.IGNORE_CASE,
    ).find(url)
    if (yt != null) return "https://i.ytimg.com/vi/${yt.groupValues[1]}/maxresdefault.jpg"
    val path = try {
        java.net.URI(url).path.orEmpty().lowercase()
    } catch (_: Exception) {
        ""
    }
    if (hasImageExtension(path)) return safe
    return null
}

private fun hasImageExtension(path: String): Boolean {
    val extensions = listOf(".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif")
    return extensions.any { path.endsWith(it) }
}
