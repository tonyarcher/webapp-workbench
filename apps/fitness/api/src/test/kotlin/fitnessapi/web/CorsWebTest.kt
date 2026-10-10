package fitnessapi.web

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.test.context.TestPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.options
import kotlin.test.assertEquals
import kotlin.test.assertNull

@WebMvcTest(HealthController::class)
@Import(CorsConfig::class)
@TestPropertySource(properties = ["CORS_ALLOWED_ORIGINS=https://cdn.example.com, https://app.example.com"])
class CorsWebTest {
    @Autowired
    lateinit var mvc: MockMvc

    @Test
    fun allowedOriginPreflightSucceeds() {
        val result = mvc.options("/healthz") {
            header("Origin", "https://cdn.example.com")
            header("Access-Control-Request-Method", "GET")
        }.andReturn()
        assertEquals(200, result.response.status)
        assertEquals("https://cdn.example.com", result.response.getHeader("Access-Control-Allow-Origin"))
    }

    @Test
    fun allowedOriginSimpleRequestEchoes() {
        val result = mvc.get("/healthz") {
            header("Origin", "https://app.example.com")
        }.andReturn()
        assertEquals(200, result.response.status)
        assertEquals("https://app.example.com", result.response.getHeader("Access-Control-Allow-Origin"))
    }

    @Test
    fun disallowedOriginAddsNoCorsHeader() {
        val result = mvc.get("/healthz") {
            header("Origin", "https://evil.example.com")
        }.andReturn()
        assertNull(result.response.getHeader("Access-Control-Allow-Origin"))
    }
}
