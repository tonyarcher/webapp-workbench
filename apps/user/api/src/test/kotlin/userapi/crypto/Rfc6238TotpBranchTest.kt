package userapi.crypto

import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import org.apache.commons.codec.binary.Base32

class Rfc6238TotpBranchTest {
    private val totp = Rfc6238Totp()
    private val secret = Base32().encodeToString("12345678901234567890".toByteArray()).trimEnd('=')
    private val now = Instant.ofEpochSecond(59)

    @Test
    fun rejectsMalformed() {
        assertFalse(totp.verify(secret, "12", now))
        assertFalse(totp.verify(secret, "abcdef", now))
        assertFalse(totp.verify(secret, "  12 34  ", now))
        assertFalse(totp.verify("!!!not-base32!!!", "287082", now))
        assertFalse(totp.verify("", "287082", now))
    }

    @Test
    fun acceptsWindow() {
        assertTrue(totp.verify(secret, "287082", now))
        assertTrue(totp.verify(secret, "287 082", now))
        assertFalse(totp.verify(secret, "287082", now.plusSeconds(300)))
    }

    @Test
    fun secretAndUri() {
        val fresh = totp.newSecret()
        assertTrue(fresh.isNotEmpty())
        assertTrue(fresh != totp.newSecret())
        val uri = totp.otpauth("alice", fresh)
        assertTrue(uri.startsWith("otpauth://totp/"))
        assertTrue(uri.contains("secret=$fresh"))
    }
}
