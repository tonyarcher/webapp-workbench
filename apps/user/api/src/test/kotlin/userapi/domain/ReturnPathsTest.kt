package userapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ReturnPathsTest {
    @Test
    fun allowsSameOriginPaths() {
        assertEquals("/fitness/", safeReturnPath("/fitness/"))
        assertEquals("/times-up/foo", safeReturnPath("/times-up/foo"))
    }

    @Test
    fun rejectsOpenRedirects() {
        assertNull(safeReturnPath("//evil.example"))
        assertNull(safeReturnPath("/\\evil"))
        assertNull(safeReturnPath("https://evil.example/"))
        assertNull(safeReturnPath("fitness/"))
        assertNull(safeReturnPath("/foo\nbar"))
        assertNull(safeReturnPath(null))
        assertNull(safeReturnPath(""))
        assertNull(safeReturnPath("   "))
        assertNull(safeReturnPath("x".repeat(300)))
        assertNull(safeReturnPath("/foo bar"))
        assertNull(safeReturnPath("/foo\\bar"))
        assertNull(safeReturnPath("/foo://bar"))
        assertNull(safeReturnPath("/ok\u001f"))
    }
}
