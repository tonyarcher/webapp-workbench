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
}
