package rssapi.domain

import java.security.MessageDigest

fun makeArticleId(feedId: String, guid: String): String {
    val md = MessageDigest.getInstance("SHA-256")
    val bytes = md.digest("$feedId\n$guid".toByteArray())
    return bytes.joinToString("") { b -> "%02x".format(b) }
}
