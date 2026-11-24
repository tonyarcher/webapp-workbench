package timesupapi.provenance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import timesupapi.articles.ArticleEntity
import timesupapi.feeds.FeedEntity
import timesupapi.feeds.FeedRepo
import java.time.Instant
import java.util.Optional
import java.util.UUID

class ProvenanceServiceTest {
    private val feeds: FeedRepo = mock()
    private val evidence: ArticleEvidenceRepo = mock()
    private val service = ProvenanceService(feeds, evidence)
    private val feedId = UUID.randomUUID()
    private val fetchedAt = Instant.parse("2026-11-23T00:00:00Z")

    private fun article() = ArticleEntity(
        id = "a1",
        feedId = feedId,
        sourceKind = "scrape",
        connectorId = "rss",
        connectorVersion = "1",
        fetchMode = "full",
        canonicalUrl = "https://example.com/canonical",
        sourceUrl = "https://example.com/source",
        fetchedAt = fetchedAt,
    )

    private fun stubEvidence() {
        whenever(evidence.findByArticleIdOrderByKindAscIdAsc("a1")).thenReturn(
            listOf(
                ArticleEvidenceEntity(
                    id = "id1",
                    articleId = "a1",
                    kind = "figure",
                    evidenceText = "Growth hit 12% last quarter",
                ),
                ArticleEvidenceEntity(
                    id = "id2",
                    articleId = "a1",
                    kind = "quote",
                    evidenceText = "Officials said it was necessary",
                ),
            ),
        )
    }

    @Test
    fun mapsTheSourceRowAndStoredEvidence() {
        whenever(feeds.findById(feedId)).thenReturn(Optional.of(FeedEntity(id = feedId, title = "Example Feed")))
        stubEvidence()

        val result = service.load(article())

        assertSource(result.source)
        assertEquals(1, result.quotes.size)
        assertEquals("id2", result.quotes.single().id)
        assertEquals(1, result.figures.size)
        assertTrue(result.figures.single().text.contains("12%"))
        assertEquals("a1", result.figures.single().articleId)
    }

    private fun assertSource(source: SourceRowJson) {
        assertEquals("a1", source.articleId)
        assertEquals(feedId.toString(), source.feedId)
        assertEquals("Example Feed", source.feedTitle)
        assertEquals("scrape", source.sourceKind)
        assertEquals("full", source.fetchMode)
        assertEquals("rss", source.connectorId)
        assertEquals("1", source.connectorVersion)
        assertEquals("https://example.com/canonical", source.canonicalUrl)
        assertEquals("https://example.com/source", source.sourceUrl)
        assertEquals(fetchedAt.toEpochMilli(), source.fetchedAt)
    }

    @Test
    fun missingFeedAndNoEvidenceStillReturnTheSourceRow() {
        whenever(feeds.findById(feedId)).thenReturn(Optional.empty())
        whenever(evidence.findByArticleIdOrderByKindAscIdAsc("a1")).thenReturn(emptyList())

        val result = service.load(article())

        assertEquals("", result.source.feedTitle)
        assertTrue(result.quotes.isEmpty())
        assertTrue(result.figures.isEmpty())
    }
}
