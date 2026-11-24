package timesupapi.fetch

import java.net.InetAddress
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class PublicHostBranchTest {
    private companion object {
        const val PIN_MS = 5 * 60_000L
    }

    @Test
    fun rejectsBadUrls() {
        assertFailsWith<Exception> { assertPublicUrl("ftp://example.com/rss", false) }
        assertFailsWith<Exception> { assertPublicUrl("https://user:pass@example.com/rss", false) }
        assertFailsWith<Exception> { assertPublicUrl("not a url", false) }
    }

    @Test
    fun allowLocalSkipsDns() {
        assertPublicUrl("https://example.com/rss", true)
        assertPublicUrl("http://127.0.0.1/rss", true)
    }

    @Test
    fun rejectsLoopback() {
        assertFailsWith<IllegalArgumentException> {
            PublicDnsResolver(false).lookup("127.0.0.1")
        }
    }

    @Test
    fun pinsTheValidatedDnsAnswer() {
        val public = InetAddress.getByName("8.8.8.8")
        val private = InetAddress.getByName("127.0.0.1")
        var calls = 0
        val resolver = PublicDnsResolver(false, resolve = {
            calls++
            if (calls == 1) arrayOf(public) else arrayOf(private)
        })

        assertEquals(listOf(public), resolver.lookup("rebind.example"))
        assertEquals(listOf(public), resolver.lookup("rebind.example"))
        assertEquals(1, calls)
    }

    @Test
    fun expiresPinnedDnsAnswers() {
        val public = InetAddress.getByName("8.8.8.8")
        val next = InetAddress.getByName("1.1.1.1")
        var now = 0L
        var calls = 0
        val resolver = PublicDnsResolver(false, resolve = {
            calls++
            if (calls == 1) arrayOf(public) else arrayOf(next)
        }, now = { now })

        assertEquals(listOf(public), resolver.lookup("rotate.example"))
        now = PIN_MS + 1
        assertEquals(listOf(next), resolver.lookup("rotate.example"))
        assertEquals(2, calls)
    }

    @Test
    fun acceptsGlobalIpv6() {
        val global = InetAddress.getByName("2001:4860:4860::8888")
        assertEquals(listOf(global), PublicDnsResolver(false, resolve = { arrayOf(global) }).lookup("v6.example"))
    }

    @Test
    fun rejectsNonGlobalIpv6AndSpecialIpv4() {
        val blocked = listOf("::1", "fd00::1", "fe80::1", "0.0.0.0", "255.255.255.255", "169.254.1.1")
        for (host in blocked) {
            val address = InetAddress.getByName(host)
            assertFailsWith<IllegalArgumentException> {
                PublicDnsResolver(false, resolve = { arrayOf(address) }).lookup(host)
            }
        }
    }

    @Test
    fun rejectsAnyPrivateAnswer() {
        val public = InetAddress.getByName("8.8.8.8")
        val private = InetAddress.getByName("10.0.0.1")
        val multicast = InetAddress.getByName("224.0.0.1")
        assertFailsWith<IllegalArgumentException> {
            PublicDnsResolver(false, resolve = { arrayOf(public, private, multicast) }).lookup("mixed.example")
        }
    }
}
