package rssapi.ingest

import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleRepo
import rssapi.persist.ArticleStateEntity
import rssapi.persist.ArticleStateRepo
import rssapi.persist.PendingStateEntity
import rssapi.persist.PendingStateRepo
import java.time.Instant
import java.util.Optional
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals

class PendingApplyTest {
    private val pending: PendingStateRepo = mock()
    private val articles: ArticleRepo = mock()
    private val states: ArticleStateRepo = mock()
    private val apply = PendingApply(pending, articles, states)
    private val feedId = UUID.randomUUID()
    private val userId = UUID.randomUUID()

    private fun row(guid: String?): PendingStateEntity = PendingStateEntity(
        userId = userId,
        feedId = feedId,
        guid = guid,
        read = true,
        starred = false,
    )

    @Test
    fun insertsWhenNoExisting() {
        val article = ArticleEntity(id = "a1", feedId = feedId, guid = "g1")
        whenever(pending.findByFeedId(feedId)).thenReturn(listOf(row("g1")))
        whenever(articles.findByFeedIdAndGuid(feedId, "g1")).thenReturn(article)
        whenever(states.findById(any())).thenReturn(Optional.empty())
        apply.applyForFeed(feedId)
        verify(states).save(any())
        verify(pending).delete(any())
    }

    @Test
    fun mergesIntoExisting() {
        val article = ArticleEntity(id = "a1", feedId = feedId, guid = "g1")
        val existing = ArticleStateEntity(userId = userId, articleId = "a1", read = false, starred = false)
        whenever(pending.findByFeedId(feedId)).thenReturn(listOf(row("g1")))
        whenever(articles.findByFeedIdAndGuid(feedId, "g1")).thenReturn(article)
        whenever(states.findById(any())).thenReturn(Optional.of(existing))
        apply.applyForFeed(feedId)
        assertEquals(true, existing.read)
        verify(states).save(existing)
    }

    @Test
    fun skipsWhenNoMatch() {
        whenever(pending.findByFeedId(feedId)).thenReturn(listOf(row(null)))
        apply.applyForFeed(feedId)
        verify(states, org.mockito.kotlin.never()).save(any())
    }

    @Test
    fun matchesByNormLink() {
        val article = ArticleEntity(id = "a2", feedId = feedId)
        val linkRow = PendingStateEntity(userId = userId, feedId = feedId, normLink = "https://example.com/x")
        whenever(pending.findByFeedId(feedId)).thenReturn(listOf(linkRow))
        whenever(articles.findByFeedIdAndNormLink(feedId, "https://example.com/x")).thenReturn(article)
        whenever(states.findById(any())).thenReturn(Optional.empty())
        apply.applyForFeed(feedId)
        verify(states).save(any())
    }

    @Test
    fun guidMismatchFallsToNull() {
        val linkRow = PendingStateEntity(userId = userId, feedId = feedId, guid = "missing-guid")
        whenever(pending.findByFeedId(feedId)).thenReturn(listOf(linkRow))
        whenever(articles.findByFeedIdAndGuid(feedId, "missing-guid")).thenReturn(null)
        apply.applyForFeed(feedId)
        verify(states, org.mockito.kotlin.never()).save(any())
    }

    @Test
    fun readAtNullKeepsExisting() {
        val article = ArticleEntity(id = "a1", feedId = feedId, guid = "g1")
        val existing = ArticleStateEntity(userId = userId, articleId = "a1", read = true)
        val late = row("g1").apply { readAt = null }
        whenever(pending.findByFeedId(feedId)).thenReturn(listOf(late))
        whenever(articles.findByFeedIdAndGuid(feedId, "g1")).thenReturn(article)
        whenever(states.findById(any())).thenReturn(Optional.of(existing))
        apply.applyForFeed(feedId)
        assertEquals(true, existing.read)
        verify(states).save(existing)
    }

    @Test
    fun keepsEarliestReadAt() {
        val article = ArticleEntity(id = "a1", feedId = feedId, guid = "g1")
        val early = Instant.parse("2026-01-01T00:00:00Z")
        val existing = ArticleStateEntity(userId = userId, articleId = "a1", readAt = early)
        val late = row("g1").apply { readAt = Instant.parse("2026-02-01T00:00:00Z") }
        whenever(pending.findByFeedId(feedId)).thenReturn(listOf(late))
        whenever(articles.findByFeedIdAndGuid(feedId, "g1")).thenReturn(article)
        whenever(states.findById(any())).thenReturn(Optional.of(existing))
        apply.applyForFeed(feedId)
        assertEquals(early, existing.readAt)
    }

    @Test
    fun keepsReadAndStarred() {
        val article = ArticleEntity(id = "a1", feedId = feedId, guid = "g1")
        val existing = ArticleStateEntity(userId = userId, articleId = "a1", read = true, starred = true)
        val row = row("g1").apply { read = false }
        whenever(pending.findByFeedId(feedId)).thenReturn(listOf(row))
        whenever(articles.findByFeedIdAndGuid(feedId, "g1")).thenReturn(article)
        whenever(states.findById(any())).thenReturn(Optional.of(existing))
        apply.applyForFeed(feedId)
        assertEquals(true, existing.read)
        assertEquals(true, existing.starred)
        verify(states).save(existing)
    }
}
