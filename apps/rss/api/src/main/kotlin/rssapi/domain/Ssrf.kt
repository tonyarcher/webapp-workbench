package rssapi.domain

// Reserved and private IPv4 blocks (RFC 1918, RFC 6598, RFC 3927). The octet
// values are the specification here, so each is named for the block it guards.
private const val OCTET_THIS_NETWORK = 0
private const val OCTET_PRIVATE_10 = 10
private const val OCTET_LOOPBACK = 127

/** 100.64.0.0/10 carrier-grade NAT. */
private const val CGNAT_FIRST = 100
private const val CGNAT_SECOND_MIN = 64
private const val CGNAT_SECOND_MAX = 127

/** 169.254.0.0/16 link-local. */
private const val LINK_LOCAL_FIRST = 169
private const val LINK_LOCAL_SECOND = 254

/** 172.16.0.0/12 private. */
private const val PRIVATE_172_FIRST = 172
private const val PRIVATE_172_SECOND_MIN = 16
private const val PRIVATE_172_SECOND_MAX = 31

/** 192.168.0.0/16 private. */
private const val PRIVATE_192_FIRST = 192
private const val PRIVATE_192_SECOND = 168

/** A dotted quad has three dots; "::ffff:" is seven characters. */
private const val IPV4_DOT_COUNT = 3
private const val IPV4_MAPPED_PREFIX_LENGTH = 7
private const val IPV4_OCTETS = 4

fun isPrivateIpv4(ip: String): Boolean {
    val parts = ip.split('.').mapNotNull { it.toIntOrNull() }
    if (parts.size != IPV4_OCTETS) return true
    val p0 = parts[0]
    val p1 = parts[1]
    if (isLoopbackOrWellKnown(p0)) return true
    if (isCarrierGrade(p0, p1)) return true
    if (isLinkLocal(p0, p1)) return true
    if (isPrivate172(p0, p1)) return true
    return isPrivate192(p0, p1)
}

private fun isLoopbackOrWellKnown(p0: Int): Boolean =
    p0 == OCTET_THIS_NETWORK || p0 == OCTET_PRIVATE_10 || p0 == OCTET_LOOPBACK

private fun isCarrierGrade(p0: Int, p1: Int): Boolean = p0 == CGNAT_FIRST && p1 in CGNAT_SECOND_MIN..CGNAT_SECOND_MAX

private fun isLinkLocal(p0: Int, p1: Int): Boolean = p0 == LINK_LOCAL_FIRST && p1 == LINK_LOCAL_SECOND

private fun isPrivate172(p0: Int, p1: Int): Boolean =
    p0 == PRIVATE_172_FIRST && p1 in PRIVATE_172_SECOND_MIN..PRIVATE_172_SECOND_MAX

private fun isPrivate192(p0: Int, p1: Int): Boolean = p0 == PRIVATE_192_FIRST && p1 == PRIVATE_192_SECOND

fun isPrivateIpv6Lower(lower: String): Boolean {
    if (lower == "::1" || lower == "::") return true
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true
    return lower.startsWith("fe8") || lower.startsWith("fe9") ||
        lower.startsWith("fea") || lower.startsWith("feb")
}

fun isPrivateIp(ip: String): Boolean {
    val lower = ip.lowercase()
    if (lower.startsWith("::ffff:")) {
        val mapped = lower.substring(IPV4_MAPPED_PREFIX_LENGTH)
        return if (mapped.count { it == '.' } == IPV4_DOT_COUNT) isPrivateIpv4(mapped) else true
    }
    if (ip.count { it == '.' } == IPV4_DOT_COUNT) return isPrivateIpv4(ip)
    return isPrivateIpv6Lower(lower)
}
