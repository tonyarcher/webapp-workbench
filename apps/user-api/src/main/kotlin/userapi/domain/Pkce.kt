package userapi.domain

import java.security.MessageDigest
import java.util.Base64

private val VERIFIER = Regex("^[A-Za-z0-9._~-]{43,128}$")

fun validCodeVerifier(verifier: String): Boolean = VERIFIER.matches(verifier)

fun pkceS256(verifier: String): String {
    val digest = MessageDigest.getInstance("SHA-256")
        .digest(verifier.toByteArray(Charsets.UTF_8))
    return Base64.getUrlEncoder().withoutPadding().encodeToString(digest)
}

fun pkceMatches(verifier: String, challenge: String): Boolean {
    if (!validCodeVerifier(verifier)) return false
    return tokenEquals(pkceS256(verifier), challenge)
}
