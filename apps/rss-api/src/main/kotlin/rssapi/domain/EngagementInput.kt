package rssapi.domain

data class EngagementInput(
    val title: String,
    val content: String? = null,
    val summary: String? = null,
    val author: String? = null,
    val media: String? = null,
)

private val URGENCY_WORDS = setOf(
    "breaking", "live", "exclusive", "just", "update", "top",
    "best", "new", "analysis", "watch", "explained",
)

fun stripTags(html: String?): String {
    if (html.isNullOrEmpty()) return ""
    return html.replace(Regex("<[^>]*>"), " ").replace(Regex("\\s+"), " ").trim()
}

fun contentEngagement(input: EngagementInput): Double {
    val content = input.content.orEmpty()
    var score = 0
    score += mediaScore(input, content)
    score += substanceScore(content)
    score += titleScore(input.title)
    if (!input.author.isNullOrEmpty()) score += 1
    score += linkScore(content)
    return score.toDouble()
}

private fun mediaScore(input: EngagementInput, content: String): Int {
    if (!input.media.isNullOrEmpty()) return 2
    if (Regex("<img[\\s>]", RegexOption.IGNORE_CASE).containsMatchIn(content)) return 2
    return 0
}

private fun substanceScore(content: String): Int {
    val words = stripTags(content).split(Regex("\\s+")).filter { it.isNotEmpty() }.size
    if (words >= 1000) return 3
    if (words >= 250) return 2
    if (words >= 50) return 1
    return 0
}

private fun titleScore(title: String): Int {
    var s = 0
    if (title.contains("!")) s += 1
    if (title.contains("?")) s += 1
    if (Regex("\\b[A-Z]{3,}\\b").containsMatchIn(title)) s += 1
    if (Regex("\\d").containsMatchIn(title)) s += 1
    val words = title.lowercase().split(Regex("[^a-z]+")).filter { it.isNotEmpty() }
    if (words.any { it in URGENCY_WORDS }) s += 1
    if (title.contains(": ")) s += 1
    return s
}

private fun linkScore(content: String): Int {
    val count = Regex("<a[\\s>]", RegexOption.IGNORE_CASE).findAll(content).count()
    return if (count >= 3) 1 else 0
}
