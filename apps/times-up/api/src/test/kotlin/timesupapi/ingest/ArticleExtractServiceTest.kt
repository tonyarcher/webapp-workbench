package timesupapi.ingest
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import timesupapi.articles.ArticleEntity
import timesupapi.articles.ArticleRepo
import timesupapi.feeds.SubscriptionRepo
import timesupapi.fetch.PageFetcher
import timesupapi.platform.ApiException
import timesupapi.platform.sanitizeHtml
import timesupapi.storage.BodyStore
import java.util.Optional
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ArticleExtractServiceTest {
    private val articles: ArticleRepo = mock()
    private val subs: SubscriptionRepo = mock()
    private val pages: PageFetcher = mock()
    private val bodyStore: BodyStore = mock()
    private val service = ArticleExtractService(articles, subs, pages, bodyStore)

    private val uid = UUID.randomUUID()
    private val feedId = UUID.randomUUID()
    private val article = ArticleEntity(
        id = "a1",
        feedId = feedId,
        guid = "g",
        title = "T",
        link = "https://example.com/story",
    )

    private val longBody = (
        "Grid operators say storage is finally economical for long projects. " +
            "Developers are reworking plans that were shelved before the recent cost decline. "
        ).repeat(8)

    @Test
    fun rejectsUnknownArticle() {
        whenever(articles.findById("missing")).thenReturn(Optional.empty())
        val err = assertFailsWith<ApiException> { service.extractForUser(uid, "missing") }
        assertEquals(HttpStatus.NOT_FOUND, err.status)
    }

    @Test
    fun rejectsUnsubscribedFeed() {
        whenever(articles.findById("a1")).thenReturn(Optional.of(article))
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(UUID.randomUUID()))
        val err = assertFailsWith<ApiException> { service.extractForUser(uid, "a1") }
        assertEquals(HttpStatus.NOT_FOUND, err.status)
    }

    @Test
    fun rejectsMissingLink() {
        val noLink = ArticleEntity(id = "a2", feedId = feedId, guid = "g2", title = "T", link = null)
        whenever(articles.findById("a2")).thenReturn(Optional.of(noLink))
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(feedId))
        val err = assertFailsWith<ApiException> { service.extractForUser(uid, "a2") }
        assertEquals(HttpStatus.BAD_REQUEST, err.status)
    }

    @Test
    fun returnsUnchangedWhenFetchFails() {
        whenever(articles.findById("a1")).thenReturn(Optional.of(article))
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(feedId))
        whenever(pages.fetchHtml(any<String>())).thenThrow(IllegalStateException("nope"))
        val res = service.extractForUser(uid, "a1")
        assertFalse(res.extracted)
        verify(articles, never()).save(any<ArticleEntity>())
    }

    @Test
    fun extractsAndPersistsMeaningfulGain() {
        whenever(articles.findById("a1")).thenReturn(Optional.of(article))
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(feedId))
        val page = """<html><body><article><p>$longBody</p></article></body></html>"""
        whenever(pages.fetchHtml("https://example.com/story")).thenReturn(page)
        whenever(articles.save(any<ArticleEntity>())).thenAnswer { it.getArgument(0) }
        val res = service.extractForUser(uid, "a1")
        assertTrue(res.extracted)
        val body = org.mockito.kotlin.argumentCaptor<String>()
        verify(bodyStore).put(org.mockito.kotlin.eq("a1"), body.capture())
        assertTrue(body.firstValue.contains("Grid operators"))
    }

    @Test
    fun prefersAmpWhenRicher() {
        whenever(articles.findById("a1")).thenReturn(Optional.of(article))
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(feedId))
        val shortBody = ("Short extract but still enough text for a result maybe. ").repeat(6)
        val page = """
            <html><head><link rel="amphtml" href="/amp/story"></head>
            <body><article><p>$shortBody</p></article></body></html>
        """.trimIndent()
        val amp = """<html><body><article><p>$longBody</p><p>$longBody</p></article></body></html>"""
        whenever(pages.fetchHtml("https://example.com/story")).thenReturn(page)
        whenever(pages.fetchHtml("https://example.com/amp/story")).thenReturn(amp)
        whenever(articles.save(any<ArticleEntity>())).thenAnswer { it.getArgument(0) }
        val res = service.extractForUser(uid, "a1")
        assertTrue(res.extracted)
        assertEquals("https://example.com/amp/story", res.sourceUrl)
    }

    @Test
    fun doesNotPersistWhenNoMeaningfulGain() {
        val rich = ArticleEntity(
            id = "a3",
            feedId = feedId,
            guid = "g3",
            title = "T",
            link = "https://example.com/story",
        )
        whenever(articles.findById("a3")).thenReturn(Optional.of(rich))
        whenever(bodyStore.get("a3")).thenReturn(sanitizeHtml("<p>$longBody$longBody</p>"))
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(feedId))
        val page = """<html><body><article><p>$longBody</p></article></body></html>"""
        whenever(pages.fetchHtml("https://example.com/story")).thenReturn(page)
        val res = service.extractForUser(uid, "a3")
        assertFalse(res.extracted)
        verify(articles, never()).save(any<ArticleEntity>())
    }
}
