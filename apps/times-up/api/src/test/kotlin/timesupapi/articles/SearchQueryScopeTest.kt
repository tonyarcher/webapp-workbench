package timesupapi.articles

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class SearchQueryScopeTest {
    @Test
    fun headlineOperatorNarrowsScope() {
        val parsed = parseSearchQueryText("battery grid in:headline")

        assertTrue(parsed.operators.headlineOnly)
        assertEquals("battery grid", parsed.text)
        assertEquals(listOf("battery", "grid"), parsed.tokens)
    }

    @Test
    fun defaultScopeIsAllFields() {
        val parsed = parseSearchQueryText("battery grid")

        assertFalse(parsed.operators.headlineOnly)
    }

    @Test
    fun otherOperatorsStillParseAlongsideScope() {
        val parsed = parseSearchQueryText("battery in:headline is:unread")

        assertTrue(parsed.operators.headlineOnly)
        assertTrue(parsed.operators.isUnread == true)
        assertEquals("battery", parsed.text)
    }

    @Test
    fun unknownScopeValueIsIgnored() {
        val parsed = parseSearchQueryText("battery in:body")

        assertFalse(parsed.operators.headlineOnly)
        assertEquals("battery", parsed.text)
    }
}
