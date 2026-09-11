package rssapi.domain

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class SsrfTest {
    @Test
    fun rejectsPrivateRanges() {
        assertTrue(isPrivateIp("127.0.0.1"))
        assertTrue(isPrivateIp("10.0.0.1"))
        assertTrue(isPrivateIp("192.168.1.1"))
        assertTrue(isPrivateIp("172.16.0.1"))
        assertTrue(isPrivateIp("169.254.1.1"))
        assertTrue(isPrivateIp("::1"))
        assertTrue(isPrivateIp("::ffff:127.0.0.1"))
        assertFalse(isPrivateIp("8.8.8.8"))
    }
}
