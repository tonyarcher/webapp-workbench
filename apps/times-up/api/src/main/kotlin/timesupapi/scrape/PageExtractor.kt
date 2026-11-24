package timesupapi.scrape
import org.jsoup.nodes.Document

/** One candidate article seen on a page. Preview only, not persisted yet. */
data class ScrapeCandidate(
    val title: String,
    val url: String,
    val published: Long? = null,
    val summary: String? = null,
    /** CSS selector that locates this article's element in the preview. */
    val elementSelector: String? = null,
)

data class ScrapeStrategy(
    val id: String,
    val label: String,
    val confidence: Float,
    /** Stored on the feed so future polls use the same list shape. */
    val selector: String? = null,
    val candidates: List<ScrapeCandidate>,
)

/**
 * One page shape. New difficult sites add a class, not a branch in a switch.
 * Confidence is a cheap deterministic heuristic; the service picks the best.
 */
interface PageExtractor {
    val id: String
    val label: String

    fun confidence(doc: Document): Float
    fun extract(doc: Document, baseUrl: String): List<ScrapeCandidate>
}
