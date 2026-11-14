package rssapi.ingest

import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import rssapi.fetch.PageFetcher
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleRepo
import rssapi.persist.SubscriptionRepo
import java.util.Optional
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertFalse

class ArticleExtractServiceTinyTest {
    private val articles: ArticleRepo = mock()
    private val subs: SubscriptionRepo = mock()
    private val pages: PageFetcher = mock()
    private val service = ArticleExtractService(articles, subs, pages)

    private val uid = UUID.randomUUID()
    private val feedId = UUID.randomUUID()

    @Test
    fun ampExtractNullDoesNotBeatPrimary() {
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
        val withAmp = """<html><head><link rel="amphtml" href="/amp"></head><body><p>tiny</p></body></html>"""
        whenever(pages.fetchHtml("https://example.com/story")).thenReturn(withAmp)
        whenever(pages.fetchHtml("https://example.com/amp")).thenReturn("""<html><body><p>tiny</p></body></html>""")
        val res = service.extractForUser(uid, "a1")
        assertFalse(res.extracted)
        verify(articles, never()).save(any<ArticleEntity>())
    }

    @Test
    fun meaningfulGainFromEmptyContent() {
        val article = ArticleEntity(
            id = "a2",
            feedId = feedId,
            guid = "g",
            title = "T",
            link = "https://example.com/story",
            contentHtml = null,
            summary = null,
        )
        whenever(articles.findById("a2")).thenReturn(Optional.of(article))
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(feedId))
        val longBody = (
            "Grid operators say storage is finally economical for long projects. " +
                "Developers are reworking plans that were shelved before the recent cost decline. "
            ).repeat(8)
        whenever(
            pages.fetchHtml("https://example.com/story"),
        ).thenReturn("""<html><body><article><p>$longBody</p></article></body></html>""")
        whenever(articles.save(any<ArticleEntity>())).thenAnswer { it.getArgument(0) }
        val res = service.extractForUser(uid, "a2")
        kotlin.test.assertTrue(res.extracted)
    }
}
