package rssapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SanitizeBranchTest {
    @Test
    fun stripNullEmpty() {
        assertEquals("", stripHtml(null))
        assertEquals("", stripHtml(""))
        assertEquals("", sanitizeHtml(null))
    }

    @Test
    fun stripCollapsesWhitespace() {
        assertEquals("hi there", stripHtml("<p>hi   \n there</p>"))
    }

    @Test
    fun sanitizeKeepsSafeDropsUnsafe() {
        val out = sanitizeHtml("<p>ok</p><script>bad()</script><a href=\"javascript:alert(1)\">x</a>")
        assertTrue(out.contains("ok"))
        assertTrue(!out.contains("script"))
        assertTrue(!out.contains("javascript:"))
    }

    @Test
    fun srcsetSafeAndUnsafe() {
        val img = "<img src=\"https://example.com/a.png\" srcset=\"%s\">"
        val good = sanitizeHtml(img.format("https://example.com/a.png 1x, https://example.com/b.png 2x"))
        assertTrue(good.contains("srcset"))
        val bad = sanitizeHtml(img.format("javascript:alert(1) 1x"))
        assertTrue(!bad.contains("javascript:"))
        val proto = sanitizeHtml(img.format("//example.com/c.png 1x"))
        assertTrue(proto.contains("https://example.com/c.png"))
        val empty = sanitizeHtml(img.format("   "))
        assertTrue(!empty.contains("srcset") || empty.contains("src="))
    }
}
