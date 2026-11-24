package timesupapi.scrape
import org.jsoup.Jsoup
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

private const val LIST_HTML = """
    <ul id="items"><li class="post"><a href="/one">One</a><p>first</p></li>
    <li class="post"><a href="/two">Two</a><p>second</p></li></ul>
    <section class="nested"><article><h3><a href="/three">Three</a></h3><time datetime="2026-11-19T00:00:00Z"></time></article></section>
"""

class ScrapeCandidatesTest {
    @Test
    fun cssPathUsesIdAndAvoidsDroppingTheFirstRow() {
        val doc = Jsoup.parse(LIST_HTML, "https://example.com")
        val first = doc.selectFirst("#items li")!!
        val path = cssPath(first)
        assertEquals("ul", path.substringBeforeLast(" > ").substringBefore(":"))
        assertEquals("li.post:nth-child(1)", path.substringAfterLast(" > "))
        assertEquals(first, doc.selectFirst(path))
    }

    @Test
    fun cssPathHandlesClassesAndNestedElements() {
        val doc = Jsoup.parse(LIST_HTML, "https://example.com")
        val path = cssPath(doc.selectFirst("article")!!)
        assertTrue(path.contains("article"))
        assertEquals(doc.selectFirst("article"), doc.selectFirst(path))
    }

    @Test
    fun escapeHandlesOddClassNames() {
        assertEquals("a\\:b", cssEscape("a:b"))
        assertEquals("plain_name-1", cssEscape("plain_name-1"))
    }

    @Test
    fun candidateFromUsesLinkedHeadingAndSelector() {
        val doc = Jsoup.parse(LIST_HTML, "https://example.com")
        val candidate = candidateFrom(doc.selectFirst("article")!!)!!
        assertEquals("Three", candidate.title)
        assertEquals("https://example.com/three", candidate.url)
        assertEquals(1_795_046_400_000L, candidate.published)
        assertTrue(candidate.elementSelector!!.contains("article"))
    }

    @Test
    fun directLinkElementsAreSupported() {
        val doc = Jsoup.parse(LIST_HTML, "https://example.com")
        assertEquals("One", candidateFrom(doc.selectFirst("a")!!)?.title)
    }

    @Test
    fun cssPathHandlesTheBodyElement() {
        val doc = Jsoup.parse(LIST_HTML, "https://example.com")
        assertEquals("body", cssPath(doc.body()))
    }

    @Test
    fun linkWithoutTextFallsBackToElementTitle() {
        val doc = Jsoup.parse("<article><a href='/one'></a>  Fallback title  </article>", "https://example.com")
        assertEquals("Fallback title", candidateFrom(doc.selectFirst("article")!!)?.title?.trim())
    }

    @Test
    fun elementsWithoutUsableLinksAreSkipped() {
        val doc = Jsoup.parse("<article><p>no link</p></article>", "https://example.com")
        assertEquals(null, candidateFrom(doc.selectFirst("article")!!))
    }
}
