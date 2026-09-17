package userapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class WebauthnOriginsTest {
    @Test
    fun parsesHttpOrigins() {
        val set = parseOrigins("http://localhost, https://example.com, ftp://no")
        assertTrue("http://localhost" in set)
        assertTrue("https://example.com" in set)
        assertEquals(2, set.size)
    }

    @Test
    fun rpIdRejectsPath() {
        assertEquals("localhost", validRpId("LocalHost"))
        assertFailsWith<IllegalArgumentException> { validRpId("example.com/app") }
        assertFailsWith<IllegalArgumentException> { validRpId("localhost:3000") }
    }
}
