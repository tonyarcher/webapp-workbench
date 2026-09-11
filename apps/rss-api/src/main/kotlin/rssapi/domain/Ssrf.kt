package rssapi.domain

fun isPrivateIpv4(ip: String): Boolean {
    val parts = ip.split('.').mapNotNull { it.toIntOrNull() }
    if (parts.size != 4) return true
    val p0 = parts[0]
    val p1 = parts[1]
    if (p0 == 0 || p0 == 10 || p0 == 127) return true
    if (p0 == 100 && p1 in 64..127) return true
    if (p0 == 169 && p1 == 254) return true
    if (p0 == 172 && p1 in 16..31) return true
    return p0 == 192 && p1 == 168
}

fun isPrivateIpv6Lower(lower: String): Boolean {
    if (lower == "::1" || lower == "::") return true
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true
    return lower.startsWith("fe8") || lower.startsWith("fe9") ||
        lower.startsWith("fea") || lower.startsWith("feb")
}

fun isPrivateIp(ip: String): Boolean {
    val lower = ip.lowercase()
    if (lower.startsWith("::ffff:")) {
        val mapped = lower.substring(7)
        return if (mapped.count { it == '.' } == 3) isPrivateIpv4(mapped) else true
    }
    if (ip.count { it == '.' } == 3) return isPrivateIpv4(ip)
    return isPrivateIpv6Lower(lower)
}
