package rssapi.ingest

import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import rssapi.domain.sanitizeHtml
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

class ArticleExtractServiceMoreTest {
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

    private fun article(id: String = "a1", content: String = "<p>short</p>") = ArticleEntity(
        id = id,
        feedId = feedId,
        guid = "g",
        title = "T",
        link = "https://example.com/story",
        contentHtml = content,
    )

    private fun stub(a: ArticleEntity) {
        whenever(articles.findById(a.id)).thenReturn(Optional.of(a))
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(feedId))
    }

    @Test
    fun ampFetchFailureFallsBackToPrimaryExtract() {
        val a = article()
        stub(a)
        val primary = """<html><body><article><p>$longBody</p></article></body></html>"""
        val withAmp =
            """<html><head><link rel="amphtml" href="/amp"></head>""" +
                """<body><article><p>$longBody</p></article></body></html>"""
        whenever(pages.fetchHtml("https://example.com/story")).thenReturn(withAmp)
        whenever(pages.fetchHtml("https://example.com/amp")).thenThrow(IllegalStateException("amp down"))
        whenever(articles.save(any<ArticleEntity>())).thenAnswer { it.getArgument(0) }
        val res = service.extractForUser(uid, a.id)
        assertTrue(res.extracted)
        assertEquals("https://example.com/story", res.sourceUrl)
    }

    @Test
    fun betterAmpButNoExtractUsesPrimary() {
        val a = article()
        stub(a)
        val withAmp =
            """<html><head><link rel="amphtml" href="/amp"></head>""" +
                """<body><article><p>$longBody</p></article></body></html>"""
        val ampNoExtract = """<html><body><p>tiny</p></body></html>"""
        whenever(pages.fetchHtml("https://example.com/story")).thenReturn(withAmp)
        whenever(pages.fetchHtml("https://example.com/amp")).thenReturn(ampNoExtract)
        whenever(articles.save(any<ArticleEntity>())).thenAnswer { it.getArgument(0) }
        val res = service.extractForUser(uid, a.id)
        assertTrue(res.extracted)
        assertEquals("https://example.com/story", res.sourceUrl)
    }

    @Test
    fun noExtractableContentReturnsUnchanged() {
        val a = article()
        stub(a)
        whenever(pages.fetchHtml("https://example.com/story")).thenReturn("""<html><body><p>tiny</p></body></html>""")
        val res = service.extractForUser(uid, a.id)
        assertFalse(res.extracted)
    }

    @Test
    fun equalLengthNotMeaningfulGain() {
        val rich = sanitizeHtml("<p>$longBody</p>")
        val a = article(id = "a2", content = rich)
        stub(a)
        whenever(
            pages.fetchHtml("https://example.com/story"),
        ).thenReturn("""<html><body><article><p>$longBody</p></article></body></html>""")
        val res = service.extractForUser(uid, a.id)
        assertFalse(res.extracted)
    }
}
