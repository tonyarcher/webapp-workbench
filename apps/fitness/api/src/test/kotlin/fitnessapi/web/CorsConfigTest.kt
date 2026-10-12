package fitnessapi.web

import org.springframework.mock.web.MockHttpServletRequest
import kotlin.test.Test
import kotlin.test.assertEquals
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
    fun corsSourceRegistersWildcard() {
        val request = MockHttpServletRequest("GET", "/healthz")
        val config = corsSourceFor(listOf("https://a.example")).getCorsConfiguration(request)!!
        assertEquals(listOf("https://a.example"), config.allowedOrigins)
        assertEquals(listOf("GET", "POST", "PUT", "DELETE", "OPTIONS"), config.allowedMethods)
        assertTrue(config.allowedHeaders?.contains("Authorization") == true)
        assertTrue(config.allowedHeaders?.contains("X-Api-Version") == true)
    }

    @Test
    fun sameHostOriginBypassesTheAllowlist() {
        val request = MockHttpServletRequest("POST", "/imports")
        request.addHeader("Origin", "https://app.example")
        request.addHeader("Host", "app.example")
        val config = corsSourceFor(listOf("https://cdn.example.com")).getCorsConfiguration(request)!!
        assertEquals(listOf("https://app.example"), config.allowedOrigins)
    }

    @Test
    fun sameHostIgnoresSchemePortAndCase() {
        // TLS terminates at the gateway and containers listen on internal
        // ports, so only the host can survive the proxy intact.
        val request = MockHttpServletRequest("POST", "/imports")
        request.addHeader("Origin", "http://APP.example.:8080")
        request.addHeader("Host", "app.example:3000")
        val config = corsSourceFor(emptyList()).getCorsConfiguration(request)!!
        assertEquals(listOf("http://APP.example.:8080"), config.allowedOrigins)
    }

    @Test
    fun foreignOriginKeepsTheAllowlist() {
        val request = MockHttpServletRequest("POST", "/imports")
        request.addHeader("Origin", "https://evil.example")
        request.addHeader("Host", "app.example")
        val config = corsSourceFor(listOf("https://cdn.example.com")).getCorsConfiguration(request)!!
        assertEquals(listOf("https://cdn.example.com"), config.allowedOrigins)
    }

    @Test
    fun missingOriginKeepsTheAllowlist() {
        val request = MockHttpServletRequest("GET", "/healthz")
        request.addHeader("Host", "app.example")
        val config = corsSourceFor(listOf("https://a.example")).getCorsConfiguration(request)!!
        assertEquals(listOf("https://a.example"), config.allowedOrigins)
    }
}
