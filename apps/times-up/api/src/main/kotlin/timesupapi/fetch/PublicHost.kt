package timesupapi.fetch

import timesupapi.platform.isPrivateIp
import java.net.Inet6Address
import java.net.InetAddress
import java.net.URI
import java.util.concurrent.ConcurrentHashMap

/** Validates URL shape without performing a separate, unpinned DNS lookup. */
fun assertPublicUrl(raw: String, allowLocal: Boolean) {
    val url = URI(raw).toURL()
    require(url.protocol == "http" || url.protocol == "https") { "Only http/https URLs are allowed" }
    require(url.userInfo == null) { "URLs with credentials are not allowed" }
    require(url.host.isNotBlank()) { "URL host is required" }
    if (allowLocal) return
}

/**
 * Resolves once, validates every address, and pins the result for the transport
 * that uses this resolver. The connection therefore cannot observe a different
 * DNS answer between validation and connect (DNS rebinding).
 */
internal class PublicDnsResolver(
    val allowLocal: Boolean,
    private val resolve: (String) -> Array<InetAddress> = InetAddress::getAllByName,
    private val now: () -> Long = System::currentTimeMillis,
) {
    private data class Pinned(val addresses: List<InetAddress>, val expiresAt: Long)

    private val pinned = ConcurrentHashMap<String, Pinned>()

    fun lookup(host: String): List<InetAddress> {
        val key = host.lowercase().removePrefix("[").removeSuffix("]")
        val nowMs = now()
        pinned[key]?.takeIf { it.expiresAt > nowMs }?.let { return it.addresses }
        val addresses = resolve(key).toList()
        require(
            addresses.isNotEmpty() &&
                (allowLocal || addresses.none { unsafeAddress(it) }),
        ) {
            "Refusing to fetch a private address"
        }
        val entry = Pinned(addresses, nowMs + PIN_MS)
        pinned[key] = entry
        return entry.addresses
    }

    private fun unsafeAddress(address: InetAddress): Boolean {
        val firstOctet = address.hostAddress.substringBefore('.').toIntOrNull()
        return address.isAnyLocalAddress ||
            address.isLoopbackAddress ||
            address.isLinkLocalAddress ||
            address.isSiteLocalAddress ||
            address.isMulticastAddress ||
            (firstOctet != null && firstOctet >= FIRST_MULTICAST_OCTET) ||
            (address is Inet6Address && !address.isGlobalUnicastV6()) ||
            isPrivateIp(address.hostAddress)
    }

    private fun Inet6Address.isGlobalUnicastV6(): Boolean = (address[0].toInt() and GLOBAL_PREFIX_MASK) == GLOBAL_PREFIX

    private companion object {
        const val PIN_MS = 5 * 60_000L
        const val FIRST_MULTICAST_OCTET = 224
        const val GLOBAL_PREFIX_MASK = 0xe0
        const val GLOBAL_PREFIX = 0x20
    }
}
