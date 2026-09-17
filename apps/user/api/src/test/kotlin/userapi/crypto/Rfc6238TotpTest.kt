package userapi.crypto

import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import org.apache.commons.codec.binary.Base32
import userapi.domain.hashBackupCode
import userapi.domain.newBackupCodes

class Rfc6238TotpTest {
    @Test
    fun rfc6238Sha1Vector() {
        val secret = Base32().encodeToString("12345678901234567890".toByteArray()).trimEnd('=')
        val totp = Rfc6238Totp()
        assertTrue(totp.verify(secret, "287082", Instant.ofEpochSecond(59)))
        assertFalse(totp.verify(secret, "000000", Instant.ofEpochSecond(59)))
    }

    @Test
    fun backupCodesAreUniqueAndHashed() {
        val codes = newBackupCodes()
        assertTrue(codes.size == 10)
        assertTrue(codes.toSet().size == 10)
        assertTrue(codes.all { it.length == 10 })
        assertTrue(hashBackupCode("abc") == hashBackupCode("ABC"))
        assertTrue(hashBackupCode("ab-c") == hashBackupCode("abc"))
    }
}
