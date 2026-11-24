package timesupapi.scrape
import org.jsoup.nodes.Document
import org.springframework.stereotype.Component

private const val CONTAINERS = "article, li, .post, .entry, .story"
private const val STRONG_CONFIDENCE = 0.7f
private const val WEAK_CONFIDENCE = 0.5f

/** Blogs and news indexes that mark up each story as an article or list row. */
@Component
class SemanticListExtractor : PageExtractor {
    override val id = "semantic-list"
    override val label = "Article list"

    override fun confidence(doc: Document): Float = when (rows(doc).size) {
        in 4..Int.MAX_VALUE -> STRONG_CONFIDENCE
        in 2..3 -> WEAK_CONFIDENCE
        else -> 0f
    }

    override fun extract(doc: Document, baseUrl: String): List<ScrapeCandidate> = rows(doc).mapNotNull {
        candidateFrom(it)
    }

    private fun rows(doc: Document): List<org.jsoup.nodes.Element> = doc.select(CONTAINERS).filter { row ->
        row.selectFirst("h1 a, h2 a, h3 a, h4 a, a[href]") != null
    }
}
