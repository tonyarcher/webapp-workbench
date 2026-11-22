package rssapi.scrape
import org.jsoup.Jsoup
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

private const val BASE = "https://example.com/"
private const val SEMANTIC_HTML = """
    <html><head><title>Blog</title></head><body>
      <article><h2><a href="/one">One</a></h2><time datetime="2026-11-19T10:00:00Z"></time><p>First summary</p></article>
      <article><h2><a href="https://other.example/two">Two</a></h2><p>Second</p></article>
      <article><h2><a href="/three">Three</a></h2></article>
      <article><h2><a href="/four">Four</a></h2></article>
    </body></html>
"""
private const val JSON_LD_HTML = """
    <html><head><title>JSON blog</title></head><body>
      <script type="application/ld+json">
      {"@type":"ItemList","itemListElement":[
        {"@type":"ListItem","position":1,"item":{"@type":"Article","headline":"JSON One",
          "url":"/j1","datePublished":"2026-11-19T10:00:00Z","description":"Desc"}},
        {"headline":"JSON Two","url":"https://other.example/j2"}
      ]}
      </script>
    </body></html>
"""
private const val SELECTOR_HTML = """
    <html><body><div class="stories">
      <div><a href="/a">A</a><p>alpha</p></div>
      <div><a href="/b">B</a></div>
    </div></body></html>
"""

class PageExtractorsTest {
    private val semantic = SemanticListExtractor()
    private val jsonLd = JsonLdListExtractor()

    @Test
    fun semanticListFindsArticles() {
        val doc = Jsoup.parse(SEMANTIC_HTML, BASE)
        assertEquals(0.7f, semantic.confidence(doc))
        val found = semantic.extract(doc, BASE)
        assertEquals(4, found.size)
        assertEquals("One", found[0].title)
        assertEquals("https://example.com/one", found[0].url)
        assertEquals(1_795_082_400_000L, found[0].published)
        assertEquals("First summary", found[0].summary)
    }

    @Test
    fun semanticListScoresShortListsLower() {
        val two = """<article><a href="/a">A</a></article><article><a href="/b">B</a></article>"""
        val doc = Jsoup.parse(two, BASE)
        assertEquals(0.5f, semantic.confidence(doc))
        assertEquals(2, semantic.extract(doc, BASE).size)
    }

    @Test
    fun plainPageHasNoList() {
        val doc = Jsoup.parse("<html><body><p>Nothing here</p></body></html>", BASE)
        assertEquals(0f, semantic.confidence(doc))
        assertTrue(semantic.extract(doc, BASE).isEmpty())
    }

    @Test
    fun jsonLdListResolvesRelativeUrls() {
        val doc = Jsoup.parse(JSON_LD_HTML, BASE)
        assertEquals(0.8f, jsonLd.confidence(doc))
        val found = jsonLd.extract(doc, BASE)
        assertEquals(2, found.size)
        assertEquals("JSON One", found[0].title)
        assertEquals("https://example.com/j1", found[0].url)
        assertEquals(1_795_082_400_000L, found[0].published)
        assertEquals("Desc", found[0].summary)
        assertEquals("https://other.example/j2", found[1].url)
    }

    @Test
    fun jsonLdTraversesGraphAndSkipsScalars() {
        val html = """
            <script type="application/ld+json">{"@graph":[42,"x",
              {"name":"Nested","url":"/nested","dateModified":"2026-11-18T00:00:00Z"}]}</script>
        """.trimIndent()
        val found = jsonLd.extract(Jsoup.parse(html, BASE), BASE)
        assertEquals(1, found.size)
        assertEquals("Nested", found[0].title)
        assertEquals(1_794_960_000_000L, found[0].published)
    }

    @Test
    fun jsonLdArticleWithoutItemListHasConfidence() {
        val html = """<script type=application/ld+json>{"headline":"X","url":"/x"}</script>"""
        val doc = Jsoup.parse(html, BASE)
        assertEquals(0.8f, jsonLd.confidence(doc))
        assertEquals("X", jsonLd.extract(doc, BASE).single().title)
    }

    @Test
    fun jsonLdRejectsBadFields() {
        val html = """
            <script type=application/ld+json>[
              {"headline":"No URL"},
              {"headline":42,"url":"/number"},
              {"headline":"Bad date","url":"/date","datePublished":"nope","description":""},
              {"headline":"  ","url":"/blank"}
            ]</script>
        """.trimIndent()
        val found = jsonLd.extract(Jsoup.parse(html, BASE), BASE)
        assertEquals(1, found.size)
        assertEquals("Bad date", found[0].title)
        assertEquals(null, found[0].published)
        assertEquals(null, found[0].summary)
    }

    @Test
    fun semanticSkipsContainersWithoutLinks() {
        val html = """<article><p>no link</p></article><article><a href="/a">A</a></article>"""
        val doc = Jsoup.parse(html, BASE)
        assertEquals(0f, semantic.confidence(doc))
        assertEquals(1, semantic.extract(doc, BASE).size)
    }

    @Test
    fun blankSummaryAndBadDateAreDropped() {
        val html = """<article><a href="/a">A</a><p>   </p><time datetime="not-a-date"></time></article>"""
        val candidate = semantic.extract(Jsoup.parse(html, BASE), BASE).single()
        assertEquals(null, candidate.summary)
        assertEquals(null, candidate.published)
    }

    @Test
    fun anchorWithoutHrefIsNotACandidate() {
        val doc = Jsoup.parse("<article><a>A</a></article>", BASE)
        assertTrue(semantic.extract(doc, BASE).isEmpty())
    }

    @Test
    fun jsonLdIgnoresNonListAndMalformedScripts() {
        val doc = Jsoup.parse("<script type=application/ld+json>{oops</script><p>plain</p>", BASE)
        assertEquals(0f, jsonLd.confidence(doc))
        assertTrue(jsonLd.extract(doc, BASE).isEmpty())
    }

    @Test
    fun selectorExtractorUsesTheChosenContainer() {
        val doc = Jsoup.parse(SELECTOR_HTML, BASE)
        val extractor = SelectorListExtractor(".stories > div")
        assertEquals(1f, extractor.confidence(doc))
        val found = extractor.extract(doc, BASE)
        assertEquals(2, found.size)
        assertEquals("A", found[0].title)
        assertEquals("alpha", found[0].summary)
    }

    @Test
    fun selectorExtractorAcceptsLinksDirectly() {
        val doc = Jsoup.parse(SELECTOR_HTML, BASE)
        val found = SelectorListExtractor(".stories a").extract(doc, BASE)
        assertEquals(2, found.size)
    }

    @Test
    fun invalidSelectorFails() {
        val doc = Jsoup.parse(SELECTOR_HTML, BASE)
        assertFailsWith<RuntimeException> {
            SelectorListExtractor("[unclosed").extract(doc, BASE)
        }
    }

    @Test
    fun candidateUsesTimeTextWhenDatetimeIsBlank() {
        val html = """<article><a href="/a">A</a><time datetime="">2026-11-19T00:00:00Z</time></article>"""
        val candidate = semantic.extract(Jsoup.parse(html, BASE), BASE).single()
        assertEquals(1_795_046_400_000L, candidate.published)
    }

    @Test
    fun unsafeCandidateLinksAreDropped() {
        val doc = Jsoup.parse("""<article><h2><a href="javascript:alert(1)">Bad</a></h2></article>""", BASE)
        assertTrue(semantic.extract(doc, BASE).isEmpty())
    }

    @Test
    fun candidateFallsBackToElementText() {
        val doc = Jsoup.parse("""<article><a href="/a"></a>  Title here  </article>""", BASE)
        val candidate = semantic.extract(doc, BASE).single()
        assertNotNull(candidate)
        assertEquals("Title here", candidate.title.trim())
    }
}
