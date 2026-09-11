package userapi.domain

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PasswordsTest {
    @Test
    fun requiresLengthAndNotUsername() {
        assertTrue(validPassword("twelvechars!!", "alice"))
        assertFalse(validPassword("short", "alice"))
        assertFalse(validPassword("twelvechars!!", "twelvechars!!"))
        assertFalse(validPassword("            ", "alice"))
    }
}
