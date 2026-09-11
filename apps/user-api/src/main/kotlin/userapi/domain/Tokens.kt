package userapi.domain

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

private val RANDOM = SecureRandom()

fun newToken(): String {
    val bytes = ByteArray(32)
    RANDOM.nextBytes(bytes)
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
}

fun sha256Hex(value: String): String {
    val digest = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray(Charsets.UTF_8))
    return digest.joinToString("") { b -> "%02x".format(b) }
}

fun tokenEquals(left: String, right: String): Boolean {
    val a = left.toByteArray(Charsets.UTF_8)
    val b = right.toByteArray(Charsets.UTF_8)
    return MessageDigest.isEqual(a, b)
}
