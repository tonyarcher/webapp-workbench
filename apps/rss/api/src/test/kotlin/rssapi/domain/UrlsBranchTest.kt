package rssapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class UrlsBranchTest {
    @Test
    fun safeUrls() {
        assertEquals("https://example.com/rss", safeHttpUrl("  https://example.com/rss  "))
        assertEquals("http://example.com/rss", safeHttpUrl("http://example.com/rss"))
        assertNull(safeHttpUrl(null))
        assertNull(safeHttpUrl("  "))
        assertNull(safeHttpUrl("ftp://example.com/rss"))
        assertNull(safeHttpUrl("http://exa mple.com"))
    }

    @Test
    fun domains() {
        assertEquals("example.com", domainOf("https://www.example.com/a"))
        assertEquals("", domainOf(null))
        assertEquals("", domainOf(""))
        assertEquals("", domainOf("not a url"))
        assertEquals("", domainOf("mailto:foo@bar"))
        assertEquals("example.com", hostTitleFor("https://example.com/rss"))
        assertEquals("http://exa mple.com", hostTitleFor("http://exa mple.com"))
    }

    @Test
    fun uuids() {
        assertTrue(isUuid("123e4567-e89b-12d3-a456-426614174000"))
        assertTrue(isUuid("123E4567-E89B-12D3-A456-426614174000"))
        assertFalse(isUuid("nope"))
        assertFalse(isUuid(null))
        assertFalse(isUuid("123e4567-e89b-12d3-a456"))
    }
}
