package userapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class TokensTest {
    @Test
    fun tokensDifferAndHashIsStable() {
        val a = newToken()
        val b = newToken()
        assertNotEquals(a, b)
        assertEquals(64, sha256Hex(a).length)
        assertEquals(sha256Hex("x"), sha256Hex("x"))
        assertTrue(tokenEquals("abc", "abc"))
        assertFalse(tokenEquals("abc", "abd"))
    }
}
