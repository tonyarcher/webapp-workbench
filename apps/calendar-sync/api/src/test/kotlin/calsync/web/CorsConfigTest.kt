package calsync.web

import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.springframework.mock.web.MockHttpServletRequest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class CorsConfigTest {
    @Test
    fun parseAllowedOriginsSplitsAndFilters() {
        assertEquals(emptyList(), parseAllowedOrigins(null))
        assertEquals(emptyList(), parseAllowedOrigins(""))
        assertEquals(listOf("https://a.example"), parseAllowedOrigins("https://a.example"))
        assertEquals(
            listOf("https://a.example", "https://b.example"),
            parseAllowedOrigins("https://a.example, https://b.example"),
        )
        assertEquals(
            listOf("https://a.example", "https://b.example"),
            parseAllowedOrigins("https://a.example https://b.example"),
        )
    }

    @Test
    fun corsSourceRegistersAllowlist() {
        val request = MockHttpServletRequest("GET", "/healthz")
        val config = corsSourceFor(listOf("https://a.example")).getCorsConfiguration(request)!!
        assertEquals(listOf("https://a.example"), config.allowedOrigins)
        assertEquals(listOf("GET", "POST", "PUT", "DELETE", "OPTIONS"), config.allowedMethods)
        assertTrue(config.allowedHeaders?.contains("Authorization") == true)
        assertTrue(config.allowedHeaders?.contains("X-Api-Version") == true)
    }

    @Test
    fun sameHostBypassesAllowlist() {
        val request = MockHttpServletRequest("POST", "/trakt/credentials")
        request.addHeader("Origin", "https://app.example")
        request.addHeader("Host", "app.example")
        val config = corsSourceFor(listOf("https://cdn.example.com")).getCorsConfiguration(request)!!
        assertEquals(listOf("https://app.example"), config.allowedOrigins)
    }

    @Test
    fun sameHostIgnoresSchemePortAndCase() {
        val request = MockHttpServletRequest("POST", "/trakt/credentials")
        request.addHeader("Origin", "http://APP.example.:8080")
        request.addHeader("Host", "app.example:3000")
        val config = corsSourceFor(emptyList()).getCorsConfiguration(request)!!
        assertEquals(listOf("http://APP.example.:8080"), config.allowedOrigins)
    }

    @Test
    fun sameHostIpv6() {
        val request = MockHttpServletRequest("POST", "/trakt/credentials")
        request.addHeader("Origin", "http://[::1]:8080")
        request.addHeader("Host", "[::1]:3000")
        val config = corsSourceFor(emptyList()).getCorsConfiguration(request)!!
        assertEquals(listOf("http://[::1]:8080"), config.allowedOrigins)
    }

    @Test
    fun foreignHostKeepsAllowlist() {
        val request = MockHttpServletRequest("POST", "/trakt/credentials")
        request.addHeader("Origin", "https://evil.example")
        request.addHeader("Host", "app.example")
        val config = corsSourceFor(listOf("https://cdn.example.com")).getCorsConfiguration(request)!!
        assertEquals(listOf("https://cdn.example.com"), config.allowedOrigins)
    }

    @Test
    fun missingOriginKeepsAllowlist() {
        val request = MockHttpServletRequest("GET", "/healthz")
        request.addHeader("Host", "app.example")
        val config = corsSourceFor(listOf("https://a.example")).getCorsConfiguration(request)!!
        assertEquals(listOf("https://a.example"), config.allowedOrigins)
    }

    @Test
    fun missingHostKeepsAllowlist() {
        val request = MockHttpServletRequest("GET", "/healthz")
        request.addHeader("Origin", "https://app.example")
        val config = corsSourceFor(listOf("https://a.example")).getCorsConfiguration(request)!!
        assertEquals(listOf("https://a.example"), config.allowedOrigins)
    }

    @Test
    fun nullHostIsNotSameHost() {
        // MockHttpServletRequest may or may not synthesize a Host header;
        // the mock pins the null case either way.
        val request = mock<jakarta.servlet.http.HttpServletRequest> {
            on { getHeader("Origin") } doReturn "https://app.example"
            on { getHeader("Host") } doReturn null
        }
        assertFalse(isSameHost(request))
    }
}
