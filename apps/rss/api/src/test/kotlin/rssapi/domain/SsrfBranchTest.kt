package rssapi.domain

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class SsrfBranchTest {
    @Test
    fun carrierAndLinkLocal() {
        assertTrue(isPrivateIp("100.64.0.1"))
        assertTrue(isPrivateIp("100.127.255.255"))
        assertFalse(isPrivateIp("100.128.0.1"))
        assertTrue(isPrivateIp("169.254.10.20"))
        assertFalse(isPrivateIp("169.253.0.1"))
    }

    @Test
    fun private172Range() {
        assertTrue(isPrivateIp("172.16.0.1"))
        assertTrue(isPrivateIp("172.31.255.255"))
        assertFalse(isPrivateIp("172.15.0.1"))
        assertFalse(isPrivateIp("172.32.0.1"))
        assertFalse(isPrivateIp("192.167.1.1"))
        assertTrue(isPrivateIp("192.168.0.1"))
    }

    @Test
    fun malformedAndWellKnown() {
        assertFalse(isPrivateIp("not-an-ip"))
        assertTrue(isPrivateIp("a.b.c.d"))
        assertTrue(isPrivateIp("0.0.0.0"))
        assertTrue(isPrivateIp("::"))
        assertTrue(isPrivateIp("fc00::1"))
        assertTrue(isPrivateIp("fd12::1"))
        assertTrue(isPrivateIp("fe80::1"))
        assertTrue(isPrivateIp("fe9a::1"))
        assertTrue(isPrivateIp("feab::1"))
        assertTrue(isPrivateIp("feb1::1"))
        assertFalse(isPrivateIp("2001:db8::1"))
        assertTrue(isPrivateIp("::ffff:not-an-ip"))
        assertTrue(isPrivateIp("::ffff:10.0.0.1"))
        assertFalse(isPrivateIp("93.184.216.34"))
    }
}
