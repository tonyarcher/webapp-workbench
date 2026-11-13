package rssapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SearchQueryTest {
    @Test
    fun parsesPlainTextTokens() {
        val q = parseSearchQueryText("  Grid  STORAGE!! ")
        assertEquals("Grid STORAGE!!", q.text)
        assertEquals(listOf("grid", "storage"), q.tokens)
        assertEquals(false, q.hasAnyOperator())
    }

    @Test
    fun parsesAuthorAndStateOperators() {
        val q = parseSearchQueryText("author:ada is:starred is:unread battery")
        assertEquals(listOf("ada"), q.operators.authors)
        assertEquals(true, q.operators.isStarred)
        assertEquals(true, q.operators.isUnread)
        assertEquals(listOf("battery"), q.tokens)
        assertTrue(q.hasAnyOperator())
    }

    @Test
    fun parsesFeedFolderAndDateRanges() {
        val q = parseSearchQueryText("feed:\"Grid News\" folder:energy after:2026-01-02 before:2026-01-31")
        assertEquals(listOf("Grid News"), q.operators.feeds)
        assertEquals(listOf("energy"), q.operators.folders)
        assertEquals(1767312000000L, q.operators.afterMs)
        assertEquals(1769903999999L, q.operators.beforeMs)
        assertTrue(q.tokens.isEmpty())
    }

    @Test
    fun parsesVideoAndReadtime() {
        val q = parseSearchQueryText("has:video min:readtime:5")
        assertEquals(true, q.operators.hasVideo)
        assertEquals(5, q.operators.minReadMinutes)
        val q2 = parseSearchQueryText("min:7")
        assertEquals(7, q2.operators.minReadMinutes)
    }

    @Test
    fun ignoresInvalidDatesButKeepsOperatorPresence() {
        val q = parseSearchQueryText("after:not-a-date is:read")
        assertNull(q.operators.afterMs)
        assertEquals(true, q.operators.isRead)
        assertTrue(q.hasAnyOperator())
    }

    @Test
    fun handlesMalformedOperators() {
        val q = parseSearchQueryText("before:nope has:audio is:unknown min:abc")
        assertNull(q.operators.beforeMs)
        assertNull(q.operators.hasVideo)
        assertNull(q.operators.minReadMinutes)
        assertEquals(false, q.hasAnyOperator())
    }

    @Test
    fun readAndUnreadOverrideEachOther() {
        val unread = parseSearchQueryText("is:read is:unread")
        assertEquals(true, unread.operators.isUnread)
        assertNull(unread.operators.isRead)
        val read = parseSearchQueryText("is:unread is:read")
        assertEquals(true, read.operators.isRead)
        assertNull(read.operators.isUnread)
    }

    @Test
    fun anyOperatorCoversEveryField() {
        val empty = ParsedSearchQuery("", emptyList(), SearchOperators())
        assertEquals(false, empty.hasAnyOperator())
        val fields = listOf(
            SearchOperators(authors = listOf("a")),
            SearchOperators(feeds = listOf("f")),
            SearchOperators(folders = listOf("d")),
            SearchOperators(afterMs = 1),
            SearchOperators(beforeMs = 1),
            SearchOperators(isStarred = true),
            SearchOperators(isUnread = true),
            SearchOperators(isRead = true),
            SearchOperators(hasVideo = true),
            SearchOperators(minReadMinutes = 1),
        )
        fields.forEach { assertTrue(ParsedSearchQuery("", emptyList(), it).hasAnyOperator()) }
    }

    @Test
    fun enforceableOperatorCoversEveryField() {
        val empty = ParsedSearchQuery("", emptyList(), SearchOperators())
        assertEquals(false, empty.hasEnforceableOperator())
        val fields = listOf(
            SearchOperators(authors = listOf("a")),
            SearchOperators(feeds = listOf("f")),
            SearchOperators(folders = listOf("d")),
            SearchOperators(afterMs = 1),
            SearchOperators(beforeMs = 1),
            SearchOperators(isStarred = true),
            SearchOperators(isUnread = true),
            SearchOperators(isRead = true),
        )
        fields.forEach { assertTrue(ParsedSearchQuery("", emptyList(), it).hasEnforceableOperator()) }
    }
}
