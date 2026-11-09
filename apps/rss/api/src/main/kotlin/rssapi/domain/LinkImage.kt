package rssapi.domain

fun linkImage(url: String?): String? {
    if (url.isNullOrBlank()) return null
    val safe = safeHttpUrl(url) ?: return null
    val yt = Regex(
        """(?:youtube\.com/(?:watch\?[^#]*v=|embed/|shorts/|live/)|youtu\.be/)([A-Za-z0-9_-]{6,})""",
        RegexOption.IGNORE_CASE,
    ).find(url)
    if (yt != null) return "https://i.ytimg.com/vi/${yt.groupValues[1]}/hqdefault.jpg"
    // Single-URL contexts only: hqdefault exists for every video, while maxres
    // 404s (or answers a 120x90 placeholder) on non-HD uploads. Sharpness for
    // cards lives in the video-header poster chain, which probes candidates.
    val dm = Regex(
        """(?:dailymotion\.com/video/|dai\.ly/)([A-Za-z0-9]+)""",
        RegexOption.IGNORE_CASE,
    ).find(url)
    if (dm != null) return "https://www.dailymotion.com/thumbnail/video/${dm.groupValues[1]}"
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
