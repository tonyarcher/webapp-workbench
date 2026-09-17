package userapi.crypto

import com.eatthepath.otp.TimeBasedOneTimePasswordGenerator
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.security.SecureRandom
import java.time.Instant
import javax.crypto.spec.SecretKeySpec
import org.apache.commons.codec.binary.Base32
import userapi.domain.TOTP_ISSUER
import userapi.domain.TotpEngine
import userapi.domain.normalizeOtp
import userapi.domain.tokenEquals

class Rfc6238Totp : TotpEngine {
    private val totp = TimeBasedOneTimePasswordGenerator()
    private val random = SecureRandom()
    private val base32 = Base32()

    override fun newSecret(): String {
        val bytes = ByteArray(20)
        random.nextBytes(bytes)
        return base32.encodeToString(bytes).trimEnd('=')
    }

    override fun verify(secretBase32: String, code: String, now: Instant): Boolean {
        val expected = normalizeOtp(code)
        if (expected.length != 6 || expected.any { !it.isDigit() }) return false
        val key = secretKey(secretBase32) ?: return false
        for (delta in -1..1) {
            val instant = now.plusSeconds(30L * delta)
            val digits = totp.generateOneTimePassword(key, instant).toString().padStart(6, '0')
            if (tokenEquals(digits, expected)) return true
        }
        return false
    }

    override fun otpauth(username: String, secretBase32: String): String {
        val label = URLEncoder.encode("$TOTP_ISSUER:$username", StandardCharsets.UTF_8)
        val issuer = URLEncoder.encode(TOTP_ISSUER, StandardCharsets.UTF_8)
        return "otpauth://totp/$label?secret=$secretBase32&issuer=$issuer&period=30&digits=6"
    }

    private fun secretKey(secretBase32: String): SecretKeySpec? {
        return try {
            val bytes = base32.decode(secretBase32)
            if (bytes.isEmpty()) null else SecretKeySpec(bytes, totp.algorithm)
        } catch (_: Exception) {
            null
        }
    }
}
