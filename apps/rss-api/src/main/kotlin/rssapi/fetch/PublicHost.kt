package rssapi.fetch

import java.net.InetAddress
import java.net.URI
import rssapi.domain.isPrivateIp

fun assertPublicHost(raw: String, allowLocal: Boolean) {
    val url = URI(raw).toURL()
    require(url.protocol == "http" || url.protocol == "https") { "Only http/https URLs are allowed" }
    require(url.userInfo == null) { "URLs with credentials are not allowed" }
    if (allowLocal) return
    val host = url.host.removePrefix("[").removeSuffix("]")
    val addrs = InetAddress.getAllByName(host)
    require(addrs.isNotEmpty() && addrs.none { isPrivateIp(it.hostAddress) }) {
        "Refusing to fetch a private address"
    }
}
