package rssapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class CursorTest {
    @Test
    fun roundTrip() {
        val encoded = encodeCursor(1_700_000_000_000.0, "abc")
        val decoded = decodeCursor(encoded)!!
        assertEquals("abc", decoded.id)
        assertEquals(1_700_000_000_000.0, decoded.k)
        assertNull(decodeCursor("%%%not-base64"))
    }
}
