package rssapi.domain

/** Engagement points awarded per signal. */
private const val MEDIA_POINTS = 2
private const val SUBSTANCE_LONG_POINTS = 3
private const val SUBSTANCE_MEDIUM_POINTS = 2
private const val SUBSTANCE_SHORT_POINTS = 1
private const val LINK_POINTS = 1

/** Word-count tiers behind [substanceScore]. */
private const val LONG_WORDS = 1000
private const val MEDIUM_WORDS = 250
private const val SHORT_WORDS = 50

/** A body needs at least this many outbound links to read as a real post. */
private const val LINK_THRESHOLD = 3

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
    if (!input.media.isNullOrEmpty()) return MEDIA_POINTS
    if (Regex("<img[\\s>]", RegexOption.IGNORE_CASE).containsMatchIn(content)) return MEDIA_POINTS
    return 0
}

private fun substanceScore(content: String): Int {
    val words = stripTags(content).split(Regex("\\s+")).filter { it.isNotEmpty() }.size
    if (words >= LONG_WORDS) return SUBSTANCE_LONG_POINTS
    if (words >= MEDIUM_WORDS) return SUBSTANCE_MEDIUM_POINTS
    if (words >= SHORT_WORDS) return SUBSTANCE_SHORT_POINTS
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
    return if (count >= LINK_THRESHOLD) LINK_POINTS else 0
}
