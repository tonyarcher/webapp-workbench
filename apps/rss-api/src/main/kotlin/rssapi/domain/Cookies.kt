package rssapi.domain

fun parseCookies(header: String?): Map<String, String> {
    if (header.isNullOrBlank()) return emptyMap()
    val out = mutableMapOf<String, String>()
    for (pair in header.split(";")) {
        val idx = pair.indexOf("=")
        if (idx < 0) continue
        val key = pair.substring(0, idx).trim()
        val raw = pair.substring(idx + 1).trim()
        if (key.isNotEmpty()) out[key] = safeDecode(raw)
    }
    return out
}

fun cookieOpts(https: Boolean): String {
    val secure = if (https) "; Secure" else ""
    return "Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000$secure"
}

fun safeDecode(value: String): String = try {
    java.net.URLDecoder.decode(value, Charsets.UTF_8)
} catch (_: Exception) {
    value
}
