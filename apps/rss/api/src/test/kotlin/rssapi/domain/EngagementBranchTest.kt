package rssapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class EngagementBranchTest {
    @Test
    fun stripTagsBranches() {
        assertEquals("", stripTags(null))
        assertEquals("", stripTags(""))
        assertEquals("hi there", stripTags("<p>hi</p> there"))
    }

    @Test
    fun scores() {
        val bare = contentEngagement(EngagementInput(title = "plain"))
        val rich = contentEngagement(
            EngagementInput(
                title = "BREAKING: Top 10 best new updates?!",
                content = "<p>" + "word ".repeat(300) + "</p><img src=\"x\"><a href=\"1\">a</a>".repeat(4),
                author = "Jo",
                media = "https://example.com/i.png",
            ),
        )
        assertTrue(rich > bare)
    }

    @Test
    fun substanceTiers() {
        assertEquals(0.0, contentEngagement(EngagementInput(title = "t", content = "short")))
        val mid = contentEngagement(EngagementInput(title = "t", content = "<p>" + "w ".repeat(60) + "</p>"))
        assertTrue(mid >= 1.0)
        val big = contentEngagement(EngagementInput(title = "t", content = "<p>" + "w ".repeat(1100) + "</p>"))
        assertTrue(big >= 3.0)
    }
}
