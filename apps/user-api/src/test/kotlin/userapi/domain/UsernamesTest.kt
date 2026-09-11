package userapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class UsernamesTest {
    @Test
    fun acceptsLowercase() {
        assertEquals("alice", validUsername("Alice"))
        assertEquals("bob_1", validUsername("bob_1"))
    }

    @Test
    fun rejectsBad() {
        assertNull(validUsername("ab"))
        assertNull(validUsername("Alice!"))
        assertNull(validUsername("1bob"))
        assertNull(validUsername(""))
    }
}
