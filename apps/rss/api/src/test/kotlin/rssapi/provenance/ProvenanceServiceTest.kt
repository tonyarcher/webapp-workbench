package rssapi.provenance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import rssapi.articles.ArticleEntity
import rssapi.feeds.FeedEntity
import rssapi.feeds.FeedRepo
import rssapi.storage.BodyStore
import java.time.Instant
import java.util.Optional
import java.util.UUID

class ProvenanceServiceTest {
    private val feeds: FeedRepo = mock()
    private val bodyStore: BodyStore = mock()
    private val service = ProvenanceService(feeds, bodyStore)
    private val feedId = UUID.randomUUID()
    private val fetchedAt = Instant.parse("2026-11-23T00:00:00Z")

    private fun article() = ArticleEntity(
        id = "a1",
        feedId = feedId,
        excerpt = "A short local head.",
        connectorId = "rss",
        sourceKind = "scrape",
        fetchMode = "full",
        connectorVersion = "1",
        canonicalUrl = "https://example.com/canonical",
        sourceUrl = "https://example.com/source",
        fetchedAt = fetchedAt,
    )

    @Test
    fun mapsTheSourceRowAndEvidence() {
        whenever(feeds.findById(feedId)).thenReturn(
            Optional.of(FeedEntity(id = feedId, title = "Example Feed")),
        )
        whenever(bodyStore.get("a1")).thenReturn(
            "<p>The minister said the plan would cost 3.4 billion dollars next year.</p>",
        )

        val result = service.load(article())

        assertEquals("a1", result.articleId)
        assertEquals(feedId.toString(), result.source.feedId)
        assertEquals("Example Feed", result.source.feedTitle)
        assertEquals("scrape", result.source.sourceKind)
        assertEquals("full", result.source.fetchMode)
        assertEquals("rss", result.source.connectorId)
        assertEquals("1", result.source.connectorVersion)
        assertEquals("https://example.com/canonical", result.source.canonicalUrl)
        assertEquals("https://example.com/source", result.source.sourceUrl)
        assertEquals(fetchedAt.toEpochMilli(), result.source.fetchedAt)
        assertEquals(1, result.quotes.size)
        assertEquals(1, result.figures.size)
        assertEquals("a1", result.figures.single().articleId)
        assertEquals("figure", result.figures.single().kind)
    }

    @Test
    fun missingFeedStillReturnsTheSourceRow() {
        whenever(feeds.findById(feedId)).thenReturn(Optional.empty())
        whenever(bodyStore.get("a1")).thenReturn(null)

        val result = service.load(article())

        assertEquals("", result.source.feedTitle)
        assertTrue(result.quotes.isEmpty())
        assertTrue(result.figures.isEmpty())
    }
}
