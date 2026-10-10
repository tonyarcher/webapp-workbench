package stockgame.web

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
}
