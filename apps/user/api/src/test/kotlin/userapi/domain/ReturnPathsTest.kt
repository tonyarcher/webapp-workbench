package userapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ReturnPathsTest {
    @Test
    fun allowsSameOriginPaths() {
        assertEquals("/fitness/", safeReturnPath("/fitness/"))
        assertEquals("/rss-reader/foo", safeReturnPath("/rss-reader/foo"))
    }

    @Test
    fun rejectsOpenRedirects() {
        assertNull(safeReturnPath("//evil.example"))
        assertNull(safeReturnPath("/\\evil"))
        assertNull(safeReturnPath("https://evil.example/"))
        assertNull(safeReturnPath("fitness/"))
        assertNull(safeReturnPath("/foo\nbar"))
        assertNull(safeReturnPath(null))
    }
}
