package timesupapi.provenance

import timesupapi.platform.stripHtml
import java.security.MessageDigest

private const val MIN_CHARS = 30
private const val MAX_CHARS = 320
private const val MAX_ITEMS = 5

/** One verbatim evidence slice, with a stable id across re-extractions. */
data class Evidence(val id: String, val articleId: String, val kind: String, val text: String)

data class ExtractedProvenance(val quotes: List<Evidence> = emptyList(), val figures: List<Evidence> = emptyList())

/**
 * Extractive provenance for one article. Quotes and figures are verbatim
 * sentences from the stored text, never generated rewrites. No model call, so
 * the extraction is deterministic and free; the ids let other features link
 * the same evidence without copying the text.
 */
object ProvenanceExtractor {
    private val SENTENCE = Regex("(?<=[.!?])\\s+(?=[A-Z0-9\"“])")
    private val QUOTE = Regex(
        "[\"“][^\"”]{8,}[\"”]|\\b(?:said|says|according to|told|reported|quoted)\\b",
        RegexOption.IGNORE_CASE,
    )
    private val FIGURE = Regex(
        "\\b\\d+(?:[.,]\\d+)?\\s*(?:%|percent\\b|million\\b|billion\\b|trillion\\b|thousand\\b|points?\\b|years?\\b|days?\\b)",
        RegexOption.IGNORE_CASE,
    )

    fun extract(articleId: String, bodyHtml: String?, excerpt: String?): ExtractedProvenance {
        val text = stripHtml(bodyHtml.takeUnless { it.isNullOrBlank() } ?: excerpt)
        if (text.isEmpty()) return ExtractedProvenance()
        val sentences = SENTENCE.split(text)
            .map { it.trim() }
            .filter { it.length in MIN_CHARS..MAX_CHARS }
        return ExtractedProvenance(
            quotes = evidences(articleId, "quote", sentences, QUOTE),
            figures = evidences(articleId, "figure", sentences, FIGURE),
        )
    }

    /** The occurrence number keeps repeated verbatim sentences uniquely linkable. */
    private fun evidences(articleId: String, kind: String, sentences: List<String>, matcher: Regex): List<Evidence> {
        val seen = mutableMapOf<String, Int>()
        return sentences.mapNotNull { text ->
            if (!matcher.containsMatchIn(text)) return@mapNotNull null
            val occurrence = seen[text] ?: 0
            seen[text] = occurrence + 1
            evidence(articleId, kind, text, occurrence)
        }.take(MAX_ITEMS)
    }

    internal fun evidence(articleId: String, kind: String, text: String, occurrence: Int = 0): Evidence {
        val source = "$articleId\u0000$kind\u0000$occurrence\u0000$text"
        val hex = MessageDigest.getInstance("SHA-256")
            .digest(source.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
        return Evidence(id = hex, articleId = articleId, kind = kind, text = text)
    }
}
