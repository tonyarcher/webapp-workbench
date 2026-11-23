package rssapi.clusters

private val STOPWORDS = setOf(
    "about", "across", "after", "against", "also", "among", "because", "been", "before", "being", "between",
    "could", "does", "doing", "from", "have", "into", "its", "more", "most", "much", "news", "only",
    "other", "over", "said", "says", "than", "that", "their", "them", "then", "there", "these", "they",
    "this", "those", "through", "under", "very", "what", "when", "where", "which", "while", "with", "would",
    "year", "years",
)
private const val MAX_PHRASES = 3

/**
 * Learns topic keys from article text once, at extraction time.
 *
 * This is the only place that reads a headline or a link. What it produces is
 * soft-linked metadata: phrase keys plus the article's source links. Everything
 * downstream reads the keys, not the article.
 */
object TopicKeyExtractor {
    fun keys(title: String?, normLink: String?, canonicalUrl: String?, sourceUrl: String?): Set<String> {
        val words = title.orEmpty().lowercase()
            .replace(Regex("[^a-z0-9\\s]"), " ")
            .split(Regex("\\s+"))
            .filter { it.length >= 4 && it !in STOPWORDS }
        val phrases = words.zipWithNext()
            .map { (a, b) -> "phrase:$a $b" }
            .distinct()
            .sorted()
            .take(MAX_PHRASES)
        val links = listOfNotNull(normLink, canonicalUrl, sourceUrl)
            .map { normalizeLink(it) }
            .filter { it.isNotBlank() }
            .map { "link:$it" }
        return (phrases + links).toSet()
    }

    /** Tracking queries and fragments must not split one source into many keys. */
    private fun normalizeLink(raw: String): String = raw.trim().lowercase()
        .substringBefore('?')
        .substringBefore('#')
        .trimEnd('/')
}
