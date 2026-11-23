package rssapi.provenance

import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import rssapi.storage.BodyStore
import java.time.Instant

class ArticleEvidenceExtractorTest {
    private val articles: EvidenceArticleRepo = mock()
    private val evidence: ArticleEvidenceRepo = mock()
    private val bodyStore: BodyStore = mock()
    private val extractor = ArticleEvidenceExtractor(articles, evidence, bodyStore)

    private fun candidate() = object : EvidenceArticleRepo.Candidate {
        override val id = "a1"
        override val excerpt = "A short local head."
    }

    @Test
    fun learnsEvidenceThenMarksTheArticle() {
        whenever(articles.candidates(any())).thenReturn(listOf(candidate()))
        whenever(bodyStore.get("a1")).thenReturn(
            "<p>The minister said the plan would cost 3.4 billion dollars next year.</p>",
        )

        extractor.runBatch()

        val rows = argumentCaptor<List<ArticleEvidenceEntity>>()
        verify(evidence).saveAll(rows.capture())
        assertTrue(rows.firstValue.any { it.kind == "quote" })
        assertTrue(rows.firstValue.any { it.kind == "figure" })
        verify(articles).markExtracted(eq("a1"), any<Instant>())
    }

    @Test
    fun emptyTextStillMarksTheArticle() {
        val blank = object : EvidenceArticleRepo.Candidate {
            override val id = "blank"
            override val excerpt = ""
        }
        whenever(articles.candidates(any())).thenReturn(listOf(blank))
        whenever(bodyStore.get("blank")).thenReturn(null)

        extractor.runBatch()

        verify(evidence, never()).saveAll(any<List<ArticleEvidenceEntity>>())
        verify(articles).markExtracted(eq("blank"), any<Instant>())
    }

    @Test
    fun stoppedExtractorDoesNothing() {
        extractor.stop()

        extractor.runBatch()

        verify(articles, never()).candidates(any())
    }
}
