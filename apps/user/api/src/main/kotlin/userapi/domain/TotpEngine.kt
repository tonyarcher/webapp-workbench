package userapi.domain

import java.time.Instant

const val TOTP_ISSUER: String = "Workbench"
const val PENDING_MAX_AGE_SEC: Int = 5 * 60
const val BACKUP_CODE_COUNT: Int = 10

interface TotpEngine {
    fun newSecret(): String
    fun verify(secretBase32: String, code: String, now: Instant): Boolean
    fun otpauth(username: String, secretBase32: String): String
}

fun normalizeOtp(code: String): String = code.filter { it.isLetterOrDigit() }.uppercase()

fun otpLooksLikeTotp(code: String): Boolean = normalizeOtp(code).length == 6 && normalizeOtp(code).all { it.isDigit() }
