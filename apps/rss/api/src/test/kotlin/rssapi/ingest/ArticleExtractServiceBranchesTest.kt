package rssapi.ingest

import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import rssapi.fetch.PageFetcher
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleRepo
import rssapi.persist.SubscriptionRepo
import java.util.Optional
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ArticleExtractServiceBranchesTest {
    private val articles: ArticleRepo = mock()
    private val subs: SubscriptionRepo = mock()
    private val pages: PageFetcher = mock()
    private val service = ArticleExtractService(articles, subs, pages)

    private val uid = UUID.randomUUID()
    private val feedId = UUID.randomUUID()
    private val longBody = (
        "Grid operators say storage is finally economical for long projects. " +
            "Developers are reworking plans that were shelved before the recent cost decline. "
        ).repeat(8)

    @Test
    fun primaryExtractNullButAmpProvidesExtract() {
        val article = ArticleEntity(
            id = "a1",
            feedId = feedId,
            guid = "g",
            title = "T",
            link = "https://example.com/story",
            contentHtml = "<p>short</p>",
        )
        whenever(articles.findById("a1")).thenReturn(Optional.of(article))
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(feedId))
        val primary = """<html><head><link rel="amphtml" href="/amp"></head><body><p>tiny</p></body></html>"""
        val amp = """<html><body><article><p>$longBody</p></article></body></html>"""
        whenever(pages.fetchHtml("https://example.com/story")).thenReturn(primary)
        whenever(pages.fetchHtml("https://example.com/amp")).thenReturn(amp)
        whenever(articles.save(any<ArticleEntity>())).thenAnswer { it.getArgument(0) }
        val res = service.extractForUser(uid, "a1")
        assertTrue(res.extracted)
        assertEquals("https://example.com/amp", res.sourceUrl)
    }

    @Test
    fun primaryFetchFailsReturnsNoResult() {
        val article = ArticleEntity(
            id = "a2",
            feedId = feedId,
            guid = "g",
            title = "T",
            link = "https://example.com/story",
            contentHtml = "<p>short</p>",
        )
        whenever(articles.findById("a2")).thenReturn(Optional.of(article))
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(feedId))
        whenever(pages.fetchHtml("https://example.com/story")).thenThrow(IllegalStateException("boom"))
        val res = service.extractForUser(uid, "a2")
        assertFalse(res.extracted)
    }

    @Test
    fun ampSameAsLinkSkipped() {
        val article = ArticleEntity(
            id = "a3",
            feedId = feedId,
            guid = "g",
            title = "T",
            link = "https://example.com/story",
            contentHtml = "<p>short</p>",
        )
        whenever(articles.findById("a3")).thenReturn(Optional.of(article))
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(feedId))
        val primary = """<html><head><link rel="amphtml" href="https://example.com/story"></head>
            <body><article><p>$longBody</p></article></body></html>"""
        whenever(pages.fetchHtml("https://example.com/story")).thenReturn(primary)
        whenever(articles.save(any<ArticleEntity>())).thenAnswer { it.getArgument(0) }
        val res = service.extractForUser(uid, "a3")
        assertTrue(res.extracted)
        assertEquals("https://example.com/story", res.sourceUrl)
    }
}
