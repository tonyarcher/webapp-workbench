package rssapi.feeds
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

private const val FULL_FEED = """
    {
      "version": "https://jsonfeed.org/version/1.1",
      "title": "JSON News",
      "home_page_url": "https://example.com/",
      "feed_url": "https://example.com/feed.json",
      "icon": "https://example.com/icon.png",
      "items": [
        {
          "id": "j1",
          "url": "https://example.com/a",
          "title": "Hello JSON",
          "date_published": "2026-11-19T10:00:00Z",
          "author": { "name": "Ada", "url": "https://example.com/ada" },
          "content_html": "<p>Hello <b>world</b></p>",
          "summary": "A short summary",
          "tags": ["rust", "web"],
          "attachments": [
            { "url": "https://example.com/pic.png", "content_type": "image/png", "title": "Pic" }
          ]
        }
      ]
    }
"""

class FeedJsonTest {
    @Test
    fun parsesJsonFeed11() {
        val feed = parseFeedXml(FULL_FEED, 0L) // dispatch by content, not by caller
        assertEquals("JSON News", feed.title)
        assertEquals("https://example.com/", feed.siteUrl)
        assertEquals("https://example.com/icon.png", feed.icon)
        assertEquals(1, feed.items.size)
        assertItem(feed.items[0])
    }

    private fun assertItem(item: ParsedItem) {
        assertEquals("j1", item.guid)
        assertEquals("https://example.com/a", item.link)
        assertEquals("Hello JSON", item.title)
        assertEquals(1_795_082_400_000L, item.published)
        assertEquals("Ada", item.author)
        assertEquals("<p>Hello <b>world</b></p>", item.content)
        assertEquals("A short summary #rust #web", item.summary)
        assertEquals("https://example.com/pic.png", item.media)
    }

    @Test
    fun textOnlyItemUsesModifiedDateAndUrlAsId() {
        val json = """
            {
              "version": "https://jsonfeed.org/version/1",
              "title": "Plain",
              "items": [
                {
                  "url": "https://example.com/plain",
                  "title": "Text only",
                  "date_modified": "2026-01-02T03:04:05Z",
                  "content_text": "Just words"
                }
              ]
            }
        """.trimIndent()
        val item = parseFeedJson(json, 0L).items.single()
        assertEquals("https://example.com/plain", item.guid)
        assertEquals("Just words", item.content)
        assertEquals("Just words", item.summary)
        assertEquals(1_767_323_045_000L, item.published)
        assertNull(item.media)
    }

    @Test
    fun safeUrlsOnly() {
        val json = """
            {
              "version": "https://jsonfeed.org/version/1.1",
              "title": "Unsafe",
              "home_page_url": "javascript:alert(1)",
              "items": [
                { "id": "x", "url": "ftp://example.com/a", "title": "Bad" },
                { "id": "y", "title": "No link" }
              ]
            }
        """.trimIndent()
        val feed = parseFeedJson(json, 0L)
        assertNull(feed.siteUrl)
        assertNull(feed.items[0].link)
        assertEquals("x", feed.items[0].guid)
        assertEquals("y", feed.items[1].guid)
    }

    @Test
    fun acceptsEmptyItemsAndIgnoresUnknownFields() {
        val json = """
            {
              "version": "https://jsonfeed.org/version/1.1",
              "title": "Empty",
              "description": "ignored safely",
              "items": []
            }
        """.trimIndent()
        val feed = parseFeedJson(json, 0L)
        assertTrue(feed.items.isEmpty())
        assertEquals("Empty", feed.title)
    }

    @Test
    fun fallsBackOnFeedFields() {
        val json = """
            {
              "version": "https://jsonfeed.org/version/1.1",
              "feed_url": "https://example.com/feed.json",
              "favicon": "https://example.com/fav.ico",
              "items": []
            }
        """.trimIndent()
        val feed = parseFeedJson(json, 0L)
        assertEquals("Untitled feed", feed.title)
        assertEquals("https://example.com/feed.json", feed.siteUrl)
        assertEquals("https://example.com/fav.ico", feed.icon)
    }

    @Test
    fun fallsBackOnItemFields() {
        val json = """
            {
              "version": "https://jsonfeed.org/version/1.1",
              "title": "Fallbacks",
              "items": [
                {
                  "external_url": "https://example.com/one",
                  "content_html": "<p>Only HTML <img src=\"https://example.com/i.png\"></p>",
                  "attachments": [{ "url": "https://example.com/note.txt", "content_type": "text/plain" }]
                },
                { "id": "", "title": 123, "content_text": "   ", "url": null }
              ]
            }
        """.trimIndent()
        val items = parseFeedJson(json, 1234L).items
        assertEquals("https://example.com/one", items[0].link)
        assertEquals("Only HTML", items[0].summary)
        assertEquals("https://example.com/i.png", items[0].media)
        assertEquals("(untitled)", items[1].title)
        assertEquals(1234L, items[1].published)
        assertEquals("1234-Fallbacks-1", items[1].guid)
        assertNull(items[1].content)
        assertNull(items[1].summary)
    }

    @Test
    fun missingItemsIsEmpty() {
        val json = """{"version":"https://jsonfeed.org/version/1.1","title":"No items"}"""
        assertTrue(parseFeedJson(json, 0L).items.isEmpty())
    }

    @Test
    fun rejectsWrongVersionAndNonObject() {
        assertFailsWith<IllegalArgumentException> {
            parseFeedJson("""{"version":"https://jsonfeed.org/version/2","items":[]}""", 0L)
        }
        assertFailsWith<IllegalArgumentException> {
            parseFeedJson("""{"items":[]}""", 0L)
        }
        assertFailsWith<IllegalArgumentException> {
            parseFeedJson("""[]""", 0L)
        }
    }

    @Test
    fun malformedJsonFails() {
        assertFailsWith<Exception> {
            parseFeedJson("""{"version":"https://jsonfeed.org/version/1.1", """, 0L)
        }
    }
}
