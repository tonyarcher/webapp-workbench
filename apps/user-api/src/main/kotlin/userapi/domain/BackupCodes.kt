package userapi.domain

import java.security.SecureRandom

private val RANDOM = SecureRandom()
private val ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray()

fun newBackupCodes(count: Int = BACKUP_CODE_COUNT): List<String> {
    return List(count) { oneBackupCode() }
}

fun hashBackupCode(code: String): String = sha256Hex(normalizeOtp(code))

private fun oneBackupCode(): String {
    val chars = CharArray(10) { ALPHABET[RANDOM.nextInt(ALPHABET.size)] }
    return String(chars)
}
