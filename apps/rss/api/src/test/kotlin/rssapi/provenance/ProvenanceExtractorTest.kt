package rssapi.provenance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class ProvenanceExtractorTest {
    private val articleId = "a1"
    private val html = """
        <p>The minister said the plan would cost 3.4 billion dollars next year.
        Officials called it “a necessary step” during a long briefing.
        A third sentence is here only for padding and balance.</p>
    """.trimIndent()

    @Test
    fun extractsVerbatimQuotesAndFigures() {
        val result = ProvenanceExtractor.extract(articleId, html, null)

        assertEquals(2, result.quotes.size)
        assertEquals(1, result.figures.size)
        assertTrue(result.figures.single().text.contains("3.4 billion"))
        for (e in result.quotes + result.figures) {
            assertTrue(html.contains(e.text), "evidence must be a verbatim slice: ${e.text}")
        }
    }

    @Test
    fun idsAreStableForTheSameEvidence() {
        val first = ProvenanceExtractor.extract(articleId, html, null)
        val second = ProvenanceExtractor.extract(articleId, html, null)

        assertEquals(first.quotes.map { it.id }, second.quotes.map { it.id })
        assertEquals(first.figures.map { it.id }, second.figures.map { it.id })
        assertNotEquals(first.quotes.first().id, ProvenanceExtractor.evidence(articleId, "quote", "different").id)
    }

    @Test
    fun blankBodyFallsBackToTheExcerpt() {
        val excerpt = "The report said 12 percent of respondents agreed with the proposal in the survey."

        val result = ProvenanceExtractor.extract(articleId, "  ", excerpt)

        assertEquals(1, result.quotes.size)
        assertEquals(1, result.figures.size)
        assertEquals(excerpt, result.quotes.single().text)
    }

    @Test
    fun noTextHasNoEvidence() {
        val result = ProvenanceExtractor.extract(articleId, null, null)

        assertTrue(result.quotes.isEmpty())
        assertTrue(result.figures.isEmpty())
    }

    @Test
    fun evidenceIsBounded() {
        val sentence = "Officials said the number would reach 4 million users within the decade. "
        val many = "<p>${sentence.repeat(10)}</p>"

        val result = ProvenanceExtractor.extract(articleId, many, null)

        assertEquals(5, result.quotes.size)
        assertEquals(5, result.figures.size)
        assertTrue(result.quotes.all { it.text.length <= 320 })
        assertEquals(5, result.quotes.map { it.id }.toSet().size)
        assertEquals(5, result.figures.map { it.id }.toSet().size)
    }

    @Test
    fun barePercentIsAFigure() {
        val result = ProvenanceExtractor.extract(
            articleId,
            "<p>Growth hit 12% last quarter and the outlook stayed positive.</p>",
            null,
        )

        assertEquals(1, result.figures.size)
        assertTrue(result.figures.single().text.contains("12%"))
    }

    @Test
    fun shortSentencesAreIgnored() {
        val result = ProvenanceExtractor.extract(articleId, "<p>Said it. 5 percent.</p>", null)

        assertTrue(result.quotes.isEmpty())
        assertTrue(result.figures.isEmpty())
    }
}
