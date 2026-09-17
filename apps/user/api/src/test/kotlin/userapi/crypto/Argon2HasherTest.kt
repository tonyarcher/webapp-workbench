package userapi.crypto

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class Argon2HasherTest {
    @Test
    fun roundTrip() {
        val hasher = Argon2Hasher()
        val hash = hasher.hash("twelvechars!!")
        assertTrue(hash.startsWith("\$argon2id\$"))
        assertTrue(hasher.verify("twelvechars!!", hash))
        assertFalse(hasher.verify("twelvechars!!", hash + "x"))
        assertFalse(hasher.verify("wrong-password", hash))
    }
}
